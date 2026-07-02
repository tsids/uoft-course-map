import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoolGraphNode, GraphEdge, GraphNode } from "../types/graph";
import type { SettingsState } from "../types/filters";
import { layoutGraph } from "../utils/graphLayout";
import { buildNodeRoleMap, isBoolNodeVisible, isNodeVisible } from "../utils/nodeVisibility";
import { BoolNode } from "./BoolNode";
import { CourseEdge } from "./CourseEdge";
import { CourseNode } from "./CourseNode";

type CourseGraphProps = {
  nodes: GraphNode[];
  boolNodes: BoolGraphNode[];
  ghostNodes: GraphNode[];
  missingNodes: GraphNode[];
  edges: GraphEdge[];
  settings: SettingsState;
  selectedNodeId: string | null;
  theme: "light" | "dark";
  onSelectNode: (id: string | null) => void;
  onNodeDoubleClick?: (id: string) => void;
  onAddCourse?: (code: string) => void;
  onOpenCourseInfo?: (code: string) => void;
  statusVisible?: boolean;
};

type LayoutResult = Awaited<ReturnType<typeof layoutGraph>>;

const nodeTypes: NodeTypes = {
  course: CourseNode,
  bool: BoolNode,
};

const edgeTypes: EdgeTypes = {
  course: CourseEdge,
};

function edgeStyle(kind: GraphEdge["kind"], dark: boolean, highlighted: boolean, dimmed: boolean) {
  const base = highlighted ? 2.5 : 1.5;
  const opacity = dimmed ? 0.15 : highlighted ? 1 : DEFAULT_EDGE_OPACITY;

  if (kind === "corequisite") {
    return {
      stroke: dark ? "#60a5fa" : "#2563eb",
      strokeWidth: base,
      strokeDasharray: "6 4",
      opacity,
    };
  }
  if (kind === "exclusion") {
    return {
      stroke: dark ? "#f87171" : "#dc2626",
      strokeWidth: base,
      strokeDasharray: "4 4",
      opacity,
    };
  }
  if (kind === "postrequisite") {
    return {
      stroke: dark ? "#a78bfa" : "#7c3aed",
      strokeWidth: base,
      opacity,
    };
  }
  return { stroke: dark ? "#94a3b8" : "#64748b", strokeWidth: base, opacity };
}

function edgeMarkerColor(kind: GraphEdge["kind"], dark: boolean) {
  if (kind === "exclusion") return dark ? "#f87171" : "#dc2626";
  if (kind === "corequisite") return dark ? "#60a5fa" : "#2563eb";
  return dark ? "#a78bfa" : "#7c3aed";
}

const DEFAULT_EDGE_OPACITY = 0.6;

function getPrerequisitePath(
  nodeId: string,
  edges: GraphEdge[],
  kinds: ReadonlySet<GraphEdge["kind"]> = new Set(["postrequisite"]),
): Set<string> {
  const reachable = new Set<string>([nodeId]);
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.to !== current) continue;
      if (!kinds.has(edge.kind)) continue;
      if (reachable.has(edge.from)) continue;
      reachable.add(edge.from);
      stack.push(edge.from);
    }
  }

  return reachable;
}

function getImmediatePostrequisites(
  nodeId: string,
  edges: GraphEdge[],
  kinds: ReadonlySet<GraphEdge["kind"]>,
  boolNodeIds: ReadonlySet<string>,
): Set<string> {
  const related = new Set<string>();
  const visited = new Set<string>([nodeId]);
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.from !== current) continue;
      if (!kinds.has(edge.kind)) continue;
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      related.add(edge.to);
      if (boolNodeIds.has(edge.to)) stack.push(edge.to);
    }
  }

  return related;
}

function getDirectlyConnectedNodes(
  nodeId: string,
  edges: GraphEdge[],
  kinds: ReadonlySet<GraphEdge["kind"]>,
): Set<string> {
  const related = new Set<string>([nodeId]);

  for (const edge of edges) {
    if (!kinds.has(edge.kind)) continue;
    if (edge.from === nodeId) {
      related.add(edge.to);
    } else if (edge.to === nodeId) {
      related.add(edge.from);
    }
  }

  return related;
}

export function CourseGraph({
  nodes,
  boolNodes,
  ghostNodes,
  missingNodes,
  edges,
  settings,
  selectedNodeId,
  theme,
  onSelectNode,
  onNodeDoubleClick,
  onAddCourse,
  onOpenCourseInfo,
  statusVisible = false,
}: CourseGraphProps) {
  const dark = theme === "dark";
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const allNodes = useMemo(
    () => [...nodes, ...ghostNodes, ...missingNodes],
    [nodes, ghostNodes, missingNodes],
  );
  const missingNodeIds = useMemo(
    () => new Set(missingNodes.map((node) => node.id)),
    [missingNodes],
  );
  const boolNodeIds = useMemo(() => new Set(boolNodes.map((node) => node.id)), [boolNodes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      // Round to reduce churn so a re-layout only happens on meaningful resizes.
      const width = Math.round(element.clientWidth / 50) * 50;
      const height = Math.round(element.clientHeight / 50) * 50;
      setViewportWidth((prev) => (prev === width ? prev : width));
      setViewportHeight((prev) => (prev === height ? prev : height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hoverPathNodeId = hoveredNodeId;
  const selectionPathNodeId = selectedNodeId;

  const pathEdgeKinds = useMemo(
    () => new Set<GraphEdge["kind"]>(["postrequisite", "prerequisite"]),
    [],
  );

  const hoverHighlightedNodeIds = useMemo(() => {
    if (!hoverPathNodeId) return new Set<string>();
    const highlighted = getPrerequisitePath(hoverPathNodeId, edges, pathEdgeKinds);
    const relatedNodes = getDirectlyConnectedNodes(
      hoverPathNodeId,
      edges,
      new Set<GraphEdge["kind"]>(["corequisite", "exclusion"]),
    );

    for (const nodeId of relatedNodes) {
      highlighted.add(nodeId);
    }

    for (const nodeId of getImmediatePostrequisites(hoverPathNodeId, edges, pathEdgeKinds, boolNodeIds)) {
      highlighted.add(nodeId);
    }

    return highlighted;
  }, [boolNodeIds, edges, hoverPathNodeId, pathEdgeKinds]);

  const hoverDirectRelatedNodeIds = useMemo(() => {
    if (!hoverPathNodeId) return new Set<string>();
    return getDirectlyConnectedNodes(
      hoverPathNodeId,
      edges,
      new Set<GraphEdge["kind"]>(["corequisite", "exclusion"]),
    );
  }, [edges, hoverPathNodeId]);

  const selectionHighlightedNodeIds = useMemo(() => {
    if (!selectionPathNodeId) return new Set<string>();
    const highlighted = getPrerequisitePath(selectionPathNodeId, edges, pathEdgeKinds);

    for (const nodeId of getImmediatePostrequisites(selectionPathNodeId, edges, pathEdgeKinds, boolNodeIds)) {
      highlighted.add(nodeId);
    }

    return highlighted;
  }, [boolNodeIds, edges, pathEdgeKinds, selectionPathNodeId]);

  const roleMap = useMemo(() => buildNodeRoleMap(allNodes, edges), [allNodes, edges]);

  const nodeVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const node of allNodes) {
      map.set(node.id, isNodeVisible(node, roleMap));
    }
    for (const boolNode of boolNodes) {
      map.set(boolNode.id, isBoolNodeVisible(boolNode.id, edges));
    }
    return map;
  }, [allNodes, boolNodes, edges]);

  const [laidOut, setLaidOut] = useState<LayoutResult | null>(null);

  const layoutSignature = useMemo(() => {
    const nodeIds = allNodes.map((node) => node.id).join(",");
    const boolIds = boolNodes.map((node) => node.id).join(",");
    const edgeKeys = edges.map((edge) => `${edge.from}|${edge.to}|${edge.kind}`).join(",");
    const visibility = [...nodeVisibility.entries()]
      .map(([id, visible]) => (visible ? id : `!${id}`))
      .join(",");
    return `${viewportWidth}x${viewportHeight}::${nodeIds}::${boolIds}::${edgeKeys}::${visibility}`;
  }, [allNodes, boolNodes, edges, nodeVisibility, viewportWidth, viewportHeight]);

  const lastLayoutSignature = useRef<string | null>(null);

  // ELK routing is asynchronous, so layout runs in an effect and only re-runs
  // on structural changes. Highlight/hover styling is layered on separately
  // below so hovering never triggers a re-layout.
  useEffect(() => {
    if (lastLayoutSignature.current === layoutSignature) return;
    let cancelled = false;
    layoutGraph(allNodes, boolNodes, edges, {
      nodeVisibility,
      viewportWidth: viewportWidth || undefined,
      viewportHeight: viewportHeight || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        lastLayoutSignature.current = layoutSignature;
        setLaidOut(result);
      })
      .catch(() => {
        /* stale/aborted layout — ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [allNodes, boolNodes, edges, layoutSignature, nodeVisibility, viewportWidth, viewportHeight]);

  const courseById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of allNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [allNodes]);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!laidOut) return { nodes: [] as Node[], edges: [] as Edge[] };
    const isHovering = hoverPathNodeId !== null;
    const edgeIds = new Set(laidOut.edges.map((edge) => edge.id));

    const styledNodes: Node[] = laidOut.nodes.map((node) => {
      const visible = nodeVisibility.get(node.id) ?? false;
      const hoverHighlighted = hoverHighlightedNodeIds.has(node.id);
      const selectionHighlighted = selectionHighlightedNodeIds.has(node.id);
      const highlighted = hoverHighlighted || selectionHighlighted;
      const dimmed = isHovering && !hoverHighlighted && node.type === "course";

      if (node.type === "bool") {
        const boolDimmed = isHovering && !hoverHighlighted;
        return {
          ...node,
          zIndex: 10,
          style: {
            opacity: visible ? (boolDimmed ? 0.35 : 1) : 0,
            pointerEvents: visible ? "auto" : "none",
          },
          selectable: false,
          focusable: visible,
          data: {
            ...(node.data as object),
            highlighted: visible && highlighted,
            visible,
          },
        };
      }

      const course =
        courseById.get(node.id) ?? (node.data as { course?: GraphNode }).course;

      return {
        ...node,
        style: {
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        },
        selectable: visible,
        focusable: visible,
        data: {
          ...(node.data as object),
          course,
          selected: visible && node.id === selectedNodeId,
          highlighted: visible && highlighted,
          hovered: visible && node.id === hoverPathNodeId,
          dimmed: visible && dimmed,
          showNoPrerequisites: settings.showNoPrerequisites,
          visible,
          onOpenInfo: onOpenCourseInfo,
        },
      };
    });

    const styledEdges: Edge[] = laidOut.edges.map((edge) => {
      const kind = (edge.data as { kind?: GraphEdge["kind"] } | undefined)?.kind ?? "postrequisite";
      const sourceVisible = nodeVisibility.get(edge.source) ?? false;
      const targetVisible = nodeVisibility.get(edge.target) ?? false;
      const visible = sourceVisible && targetVisible;
      const hiddenByCompression = laidOut.hiddenEdgeKeys.has(edge.id);
      const bidirectional = kind === "corequisite" || kind === "exclusion";
      const hasReverseEdge = bidirectional && edgeIds.has(`${edge.target}|${edge.source}|${kind}`);
      const hiddenAsReverseDuplicate = hasReverseEdge && edge.source > edge.target;
      const markerColor = edgeMarkerColor(kind, dark);
      const hoverHighlighted =
        isHovering &&
        visible &&
        ((pathEdgeKinds.has(kind) && hoverHighlightedNodeIds.has(edge.source) && hoverHighlightedNodeIds.has(edge.target)) ||
          ((kind === "corequisite" || kind === "exclusion") &&
            ((edge.source === hoverPathNodeId && hoverDirectRelatedNodeIds.has(edge.target)) ||
              (edge.target === hoverPathNodeId && hoverDirectRelatedNodeIds.has(edge.source)))));
      const selectionHighlighted =
        selectionPathNodeId !== null &&
        visible &&
        pathEdgeKinds.has(kind) &&
        selectionHighlightedNodeIds.has(edge.source) &&
        selectionHighlightedNodeIds.has(edge.target);
      const highlighted = hoverHighlighted || selectionHighlighted;
      const dimmed = isHovering && !hoverHighlighted;
      const hidden = !visible || hiddenByCompression || hiddenAsReverseDuplicate;
      // Edges leading to a "needed but missing" prerequisite read as tentative:
      // dashed and fainter, so the unmet branch is visually distinct.
      const touchesMissing = missingNodeIds.has(edge.source) || missingNodeIds.has(edge.target);
      const baseStyle = edgeStyle(kind, dark, highlighted, dimmed);
      const baseOpacity = hidden ? 0 : dimmed ? 0.15 : highlighted ? 1 : DEFAULT_EDGE_OPACITY;

      return {
        ...edge,
        hidden,
        style: {
          ...baseStyle,
          ...(touchesMissing ? { strokeDasharray: "5 4" } : {}),
          opacity: touchesMissing && !hidden && !highlighted ? baseOpacity * 0.6 : baseOpacity,
        },
        markerStart:
          hidden || !hasReverseEdge
            ? undefined
            : { type: "arrowclosed" as const, color: markerColor },
        markerEnd:
          hidden
            ? undefined
            : { type: "arrowclosed" as const, color: markerColor },
        zIndex: highlighted ? 2 : 0,
      };
    });

    return { nodes: styledNodes, edges: styledEdges };
  }, [
    laidOut,
    courseById,
    dark,
    hoverHighlightedNodeIds,
    hoverDirectRelatedNodeIds,
    hoverPathNodeId,
    missingNodeIds,
    nodeVisibility,
    onOpenCourseInfo,
    selectedNodeId,
    selectionHighlightedNodeIds,
    selectionPathNodeId,
    settings,
    pathEdgeKinds,
  ]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const visible = (node.data as { visible?: boolean }).visible ?? true;
      if (!visible) return;
      // Clicking a faded "needed" prerequisite adds it to the selection so the
      // graph re-resolves and the course it was blocking can unlock.
      const course = (node.data as { course?: GraphNode }).course;
      if (course?.isMissing) {
        onAddCourse?.(course.code);
        return;
      }
      onSelectNode(selectedNodeId === node.id ? null : node.id);
    },
    [onAddCourse, onSelectNode, selectedNodeId],
  );

  const onNodeDoubleClickHandler = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const visible = (node.data as { visible?: boolean }).visible ?? true;
      if (!visible) return;
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick],
  );

  const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    const visible = (node.data as { visible?: boolean }).visible ?? true;
    if (!visible || node.type !== "course") return;
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .react-flow__controls button {
        background: ${dark ? "#252a33" : "#faf9f6"};
        border-color: ${dark ? "#475569" : "#e2e8f0"};
        color: ${dark ? "#e2e8f0" : "#334155"};
      }
      .react-flow__controls button:hover {
        background: ${dark ? "#1f242d" : "#f3f1ec"};
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [dark]);

  if (allNodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 bg-[#f4f2ed] dark:bg-[#1a1d23]"
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#f4f2ed] dark:bg-[#1a1d23]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClickHandler}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color={dark ? "#334155" : "#cbd5e1"} />
        {/* Keep the zoom buttons clear of the status message box at bottom-left. */}
        <Controls showInteractive={false} style={statusVisible ? { marginBottom: 52 } : undefined} />
      </ReactFlow>
    </div>
  );
}
