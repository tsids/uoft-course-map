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
  edges: GraphEdge[];
  settings: SettingsState;
  selectedNodeId: string | null;
  theme: "light" | "dark";
  onSelectNode: (id: string | null) => void;
  onNodeDoubleClick?: (id: string) => void;
  onOpenCourseInfo?: (code: string) => void;
};

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

export function CourseGraph({
  nodes,
  boolNodes,
  ghostNodes,
  edges,
  settings,
  selectedNodeId,
  theme,
  onSelectNode,
  onNodeDoubleClick,
  onOpenCourseInfo,
}: CourseGraphProps) {
  const dark = theme === "dark";
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const allNodes = useMemo(() => [...nodes, ...ghostNodes], [nodes, ghostNodes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      // Round to reduce churn so a re-layout only happens on meaningful resizes.
      const width = Math.round(element.clientWidth / 50) * 50;
      setViewportWidth((prev) => (prev === width ? prev : width));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hoverPathNodeId = hoveredNodeId;
  const selectionPathNodeId = settings.highlightPath ? selectedNodeId : null;

  const pathEdgeKinds = useMemo(() => {
    const kinds = new Set<GraphEdge["kind"]>(["postrequisite"]);
    if (settings.showPrerequisites) {
      kinds.add("prerequisite");
    }
    return kinds;
  }, [settings.showPrerequisites]);

  const hoverHighlightedNodeIds = useMemo(() => {
    if (!hoverPathNodeId) return new Set<string>();
    return getPrerequisitePath(hoverPathNodeId, edges, pathEdgeKinds);
  }, [edges, hoverPathNodeId, pathEdgeKinds]);

  const selectionHighlightedNodeIds = useMemo(() => {
    if (!selectionPathNodeId) return new Set<string>();
    return getPrerequisitePath(selectionPathNodeId, edges, pathEdgeKinds);
  }, [edges, pathEdgeKinds, selectionPathNodeId]);

  const roleMap = useMemo(() => buildNodeRoleMap(allNodes, edges), [allNodes, edges]);

  const nodeVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const node of allNodes) {
      map.set(node.id, isNodeVisible(node, settings, roleMap));
    }
    for (const boolNode of boolNodes) {
      map.set(boolNode.id, isBoolNodeVisible(boolNode.id, settings, edges));
    }
    return map;
  }, [allNodes, boolNodes, edges, settings.showPrerequisites]);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    const laidOut = layoutGraph(allNodes, boolNodes, edges, {
      nodeVisibility,
      settings,
      viewportWidth: viewportWidth || undefined,
    });
    const isHovering = hoverPathNodeId !== null;

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
      const hoverHighlighted =
        isHovering &&
        visible &&
        pathEdgeKinds.has(kind) &&
        hoverHighlightedNodeIds.has(edge.source) &&
        hoverHighlightedNodeIds.has(edge.target);
      const selectionHighlighted =
        selectionPathNodeId !== null &&
        visible &&
        pathEdgeKinds.has(kind) &&
        selectionHighlightedNodeIds.has(edge.source) &&
        selectionHighlightedNodeIds.has(edge.target);
      const highlighted = hoverHighlighted || selectionHighlighted;
      const dimmed = isHovering && !hoverHighlighted;

      return {
        ...edge,
        hidden: !visible || hiddenByCompression,
        style: {
          ...edgeStyle(kind, dark, highlighted, dimmed),
          opacity: !visible || hiddenByCompression ? 0 : dimmed ? 0.15 : highlighted ? 1 : DEFAULT_EDGE_OPACITY,
        },
        markerEnd:
          !visible || hiddenByCompression
            ? undefined
            : kind === "exclusion"
              ? { type: "arrowclosed" as const, color: dark ? "#f87171" : "#dc2626" }
              : { type: "arrowclosed" as const, color: dark ? "#a78bfa" : "#7c3aed" },
        zIndex: highlighted ? 2 : 0,
      };
    });

    return { nodes: styledNodes, edges: styledEdges };
  }, [
    allNodes,
    boolNodes,
    dark,
    edges,
    hoverHighlightedNodeIds,
    hoverPathNodeId,
    nodeVisibility,
    onOpenCourseInfo,
    selectedNodeId,
    selectionHighlightedNodeIds,
    selectionPathNodeId,
    settings,
    pathEdgeKinds,
    viewportWidth,
  ]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const visible = (node.data as { visible?: boolean }).visible ?? true;
      if (!visible) return;
      onSelectNode(selectedNodeId === node.id ? null : node.id);
    },
    [onSelectNode, selectedNodeId],
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
        background: ${dark ? "#252a33" : "#ffffff"};
        border-color: ${dark ? "#475569" : "#e2e8f0"};
        color: ${dark ? "#e2e8f0" : "#334155"};
      }
      .react-flow__controls button:hover {
        background: ${dark ? "#1f242d" : "#f8fafc"};
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [dark]);

  if (allNodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 bg-[#f4f6f8] dark:bg-[#1a1d23]"
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#f4f6f8] dark:bg-[#1a1d23]">
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
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
