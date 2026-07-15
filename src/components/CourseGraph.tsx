import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import fnv1a from "@sindresorhus/fnv1a";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoolGraphNode, DiffSide, GraphEdge, GraphNode } from "../types/graph";
import type { SettingsState } from "../types/filters";
import { layoutGraph } from "../utils/graphLayout";
import {
  buildNodeRoleMap,
  buildPrereqCollapseKeepSet,
  isBoolNodeVisible,
  isNodeVisible,
} from "../utils/nodeVisibility";
import { BoolNode } from "./BoolNode";
import { CourseEdge } from "./CourseEdge";
import { CourseNode } from "./CourseNode";

type CourseGraphProps = {
  nodes: GraphNode[];
  boolNodes: BoolGraphNode[];
  ghostNodes: GraphNode[];
  missingNodes: GraphNode[];
  edges: GraphEdge[];
  diffMap?: Map<string, DiffSide> | null;
  campusFilter: string[];
  settings: SettingsState;
  selectedNodeIds: string[];
  hiddenEdgeKinds?: GraphEdge["kind"][];
  theme: "light" | "dark";
  fitViewKey: string;
  onSelectNode: (id: string | null) => void;
  onAddCourse?: (code: string) => void;
  onOpenCourseInfo?: (code: string) => void;
  onHideCourse?: (code: string) => void;
  onLayoutPendingChange?: (pending: boolean) => void;
};

type LayoutResult = Awaited<ReturnType<typeof layoutGraph>>;

const nodeTypes: NodeTypes = {
  course: CourseNode,
  bool: BoolNode,
};

const edgeTypes: EdgeTypes = {
  course: CourseEdge,
};

function edgeStyle(kind: GraphEdge["kind"], dark: boolean, highlighted: boolean) {
  const base = highlighted ? 3.5 : 2;
  const opacity = highlighted ? 1 : DEFAULT_EDGE_OPACITY;

  if (kind === "corequisite") {
    return {
      stroke: highlighted
        ? dark
          ? "var(--color-edge-coreq-strong-dark)"
          : "var(--color-edge-coreq-strong)"
        : dark
          ? "var(--color-edge-coreq-dark)"
          : "var(--color-edge-coreq)",
      strokeWidth: highlighted ? 3.5 : 2,
      strokeDasharray: "6 4",
      opacity,
    };
  }
  if (kind === "exclusion") {
    return {
      stroke: highlighted
        ? dark
          ? "var(--color-edge-exclusion-strong-dark)"
          : "var(--color-edge-exclusion-strong)"
        : dark
          ? "var(--color-edge-exclusion-dark)"
          : "var(--color-edge-exclusion)",
      strokeWidth: highlighted ? 3.5 : 2,
      strokeDasharray: "4 4",
      opacity,
    };
  }
  if (highlighted) {
    return {
      stroke: dark ? "var(--color-edge-active-dark)" : "var(--color-edge-active)",
      strokeWidth: base,
      opacity,
    };
  }
  if (kind === "postrequisite") {
    return {
      stroke: dark ? "var(--color-edge-postreq-dark)" : "var(--color-edge-postreq)",
      strokeWidth: 1.75,
      opacity,
    };
  }
  return {
    stroke: dark ? "var(--color-edge-prereq-dark)" : "var(--color-edge-prereq)",
    strokeWidth: base,
    opacity,
  };
}

function edgeMarkerColor(kind: GraphEdge["kind"], dark: boolean, highlighted: boolean) {
  if (kind === "exclusion") {
    return highlighted
      ? dark
        ? "var(--color-edge-exclusion-strong-dark)"
        : "var(--color-edge-exclusion-strong)"
      : dark
        ? "var(--color-edge-exclusion-dark)"
        : "var(--color-edge-exclusion)";
  }
  if (kind === "corequisite") {
    return highlighted
      ? dark
        ? "var(--color-edge-coreq-strong-dark)"
        : "var(--color-edge-coreq-strong)"
      : dark
        ? "var(--color-edge-coreq-dark)"
        : "var(--color-edge-coreq)";
  }
  if (highlighted) return dark ? "var(--color-edge-active-dark)" : "var(--color-edge-active)";
  if (kind === "prerequisite") {
    return dark ? "var(--color-edge-prereq-dark)" : "var(--color-edge-prereq)";
  }
  return dark ? "var(--color-edge-postreq-dark)" : "var(--color-edge-postreq)";
}

const DEFAULT_EDGE_OPACITY = 0.6;
const CULL_OFFSCREEN_NODE_COUNT = 200;
const LAYOUT_CACHE_LIMIT = 20;

const layoutCache = new Map<string, LayoutResult>();

function getCachedLayout(signature: string): LayoutResult | undefined {
  const cached = layoutCache.get(signature);
  if (cached) {
    layoutCache.delete(signature);
    layoutCache.set(signature, cached);
  }
  return cached;
}

function setCachedLayout(signature: string, result: LayoutResult) {
  layoutCache.set(signature, result);
  if (layoutCache.size > LAYOUT_CACHE_LIMIT) {
    const oldest = layoutCache.keys().next().value;
    if (oldest !== undefined) layoutCache.delete(oldest);
  }
}

type EdgeIndex = {
  incoming: Map<string, GraphEdge[]>;
  outgoing: Map<string, GraphEdge[]>;
};

function buildEdgeIndex(edges: GraphEdge[]): EdgeIndex {
  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const into = incoming.get(edge.to);
    if (into) {
      into.push(edge);
    } else {
      incoming.set(edge.to, [edge]);
    }
    const outOf = outgoing.get(edge.from);
    if (outOf) {
      outOf.push(edge);
    } else {
      outgoing.set(edge.from, [edge]);
    }
  }
  return { incoming, outgoing };
}

function getPrerequisitePath(
  nodeId: string,
  edgeIndex: EdgeIndex,
  kinds: ReadonlySet<GraphEdge["kind"]> = new Set(["postrequisite"]),
): Set<string> {
  const reachable = new Set<string>([nodeId]);
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edgeIndex.incoming.get(current) ?? []) {
      if (!kinds.has(edge.kind)) continue;
      if (reachable.has(edge.from)) continue;
      reachable.add(edge.from);
      stack.push(edge.from);
    }
  }

  return reachable;
}

function getImmediatePrerequisites(
  nodeId: string,
  edgeIndex: EdgeIndex,
  kinds: ReadonlySet<GraphEdge["kind"]>,
  boolNodeIds: ReadonlySet<string>,
): Set<string> {
  const related = new Set<string>();
  const visited = new Set<string>([nodeId]);
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edgeIndex.incoming.get(current) ?? []) {
      if (!kinds.has(edge.kind)) continue;
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      related.add(edge.from);
      if (boolNodeIds.has(edge.from)) stack.push(edge.from);
    }
  }

  return related;
}

function getImmediatePostrequisites(
  nodeId: string,
  edgeIndex: EdgeIndex,
  kinds: ReadonlySet<GraphEdge["kind"]>,
  boolNodeIds: ReadonlySet<string>,
): Set<string> {
  const related = new Set<string>();
  const visited = new Set<string>([nodeId]);
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edgeIndex.outgoing.get(current) ?? []) {
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
  edgeIndex: EdgeIndex,
  kinds: ReadonlySet<GraphEdge["kind"]>,
): Set<string> {
  const related = new Set<string>([nodeId]);

  for (const edge of edgeIndex.outgoing.get(nodeId) ?? []) {
    if (kinds.has(edge.kind)) related.add(edge.to);
  }
  for (const edge of edgeIndex.incoming.get(nodeId) ?? []) {
    if (kinds.has(edge.kind)) related.add(edge.from);
  }

  return related;
}

const PROGRESS_DURATION_SECONDS = 30;

function progressBarLoadingCourses(elapsedSeconds: number): number {
  const x = Math.min(Math.max(elapsedSeconds / PROGRESS_DURATION_SECONDS, 0), 1);
  return 0.99 * (1 - Math.pow(1 - x, 3));
}

function depsEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function createStyleCache<T>() {
  const cache = new Map<string, { deps: readonly unknown[]; styled: T }>();
  return (id: string, deps: readonly unknown[], build: () => T): T => {
    const cached = cache.get(id);
    if (cached && depsEqual(cached.deps, deps)) return cached.styled;
    const styled = build();
    cache.set(id, { deps, styled });
    return styled;
  };
}

export function CourseGraph({
  nodes,
  boolNodes,
  ghostNodes,
  missingNodes,
  edges,
  diffMap = null,
  campusFilter,
  settings,
  selectedNodeIds,
  hiddenEdgeKinds,
  theme,
  fitViewKey,
  onSelectNode,
  onAddCourse,
  onOpenCourseInfo,
  onHideCourse,
  onLayoutPendingChange,
}: CourseGraphProps) {
  const dark = theme === "dark";
  const hiddenEdgeKindSet = useMemo(
    () => new Set<GraphEdge["kind"]>(hiddenEdgeKinds ?? []),
    [hiddenEdgeKinds],
  );
  const [spotlightNodeId, setSpotlightNodeId] = useState<string | null>(null);
  const spotlightIdRef = useRef<string | null>(null);
  const spotlightTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const allNodes = useMemo(
    () => [...nodes, ...ghostNodes, ...missingNodes],
    [nodes, ghostNodes, missingNodes],
  );
  const boolNodeIds = useMemo(() => new Set(boolNodes.map((node) => node.id)), [boolNodes]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let timer: number | null = null;
    const update = () => {
      const width = Math.round(element.clientWidth / 50) * 50;
      const height = Math.round(element.clientHeight / 50) * 50;
      setViewportWidth((prev) => (prev === width ? prev : width));
      setViewportHeight((prev) => (prev === height ? prev : height));
    };
    update();
    const observer = new ResizeObserver(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(update, 250);
    });
    observer.observe(element);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const hoverPathNodeId = spotlightNodeId;
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const pathEdgeKinds = useMemo(
    () => new Set<GraphEdge["kind"]>(["postrequisite", "prerequisite"]),
    [],
  );

  const directEdgeKinds = useMemo(
    () => new Set<GraphEdge["kind"]>(["corequisite", "exclusion"]),
    [],
  );

  const edgeIndex = useMemo(() => buildEdgeIndex(edges), [edges]);

  const hoverHighlightedNodeIds = useMemo(() => {
    if (!hoverPathNodeId) return new Set<string>();
    const highlighted = boolNodeIds.has(hoverPathNodeId)
      ? new Set([
          hoverPathNodeId,
          ...getImmediatePrerequisites(hoverPathNodeId, edgeIndex, pathEdgeKinds, boolNodeIds),
        ])
      : getPrerequisitePath(hoverPathNodeId, edgeIndex, pathEdgeKinds);
    const relatedNodes = getDirectlyConnectedNodes(hoverPathNodeId, edgeIndex, directEdgeKinds);

    for (const nodeId of relatedNodes) {
      highlighted.add(nodeId);
    }

    for (const nodeId of getImmediatePostrequisites(hoverPathNodeId, edgeIndex, pathEdgeKinds, boolNodeIds)) {
      highlighted.add(nodeId);
    }

    return highlighted;
  }, [boolNodeIds, directEdgeKinds, edgeIndex, hoverPathNodeId, pathEdgeKinds]);

  const hoverDirectRelatedNodeIds = useMemo(() => {
    if (!hoverPathNodeId) return new Set<string>();
    return getDirectlyConnectedNodes(hoverPathNodeId, edgeIndex, directEdgeKinds);
  }, [directEdgeKinds, edgeIndex, hoverPathNodeId]);

  const selectionDirectRelatedSets = useMemo(
    () =>
      selectedNodeIds.map((nodeId) =>
        getDirectlyConnectedNodes(nodeId, edgeIndex, directEdgeKinds),
      ),
    [directEdgeKinds, edgeIndex, selectedNodeIds],
  );

  const selectionHighlightSets = useMemo(
    () =>
      selectedNodeIds.map((nodeId, index) => {
        const highlighted = boolNodeIds.has(nodeId)
          ? new Set([
              nodeId,
              ...getImmediatePrerequisites(nodeId, edgeIndex, pathEdgeKinds, boolNodeIds),
            ])
          : getPrerequisitePath(nodeId, edgeIndex, pathEdgeKinds);

        for (const relatedId of selectionDirectRelatedSets[index]) {
          highlighted.add(relatedId);
        }

        for (const relatedId of getImmediatePostrequisites(nodeId, edgeIndex, pathEdgeKinds, boolNodeIds)) {
          highlighted.add(relatedId);
        }

        return highlighted;
      }),
    [boolNodeIds, edgeIndex, pathEdgeKinds, selectedNodeIds, selectionDirectRelatedSets],
  );

  const selectionHighlightedNodeIds = useMemo(() => {
    const union = new Set<string>();
    for (const set of selectionHighlightSets) {
      for (const nodeId of set) {
        union.add(nodeId);
      }
    }
    return union;
  }, [selectionHighlightSets]);

  const roleMap = useMemo(() => buildNodeRoleMap(allNodes, edges), [allNodes, edges]);

  const campusFilterSet = useMemo(() => new Set(campusFilter), [campusFilter]);

  const hasSelectedCourse = useMemo(
    () => allNodes.some((node) => node.isRoot),
    [allNodes],
  );
  const hidePrerequisites = hiddenEdgeKindSet.has("prerequisite") && hasSelectedCourse;

  const prereqCollapseKeepSet = useMemo(
    () =>
      hidePrerequisites ? buildPrereqCollapseKeepSet(allNodes, edges, roleMap) : null,
    [hidePrerequisites, allNodes, edges, roleMap],
  );

  const nodeVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    const collapsed = (id: string) =>
      prereqCollapseKeepSet !== null && !prereqCollapseKeepSet.has(id);
    for (const node of allNodes) {
      map.set(node.id, !collapsed(node.id) && isNodeVisible(node, roleMap, campusFilterSet));
    }
    for (const boolNode of boolNodes) {
      map.set(boolNode.id, !collapsed(boolNode.id) && isBoolNodeVisible(boolNode.id, edges));
    }
    return map;
  }, [allNodes, boolNodes, campusFilterSet, edges, roleMap, prereqCollapseKeepSet]);

  const [laidOut, setLaidOut] = useState<LayoutResult | null>(null);
  const [layoutPending, setLayoutPending] = useState(true);
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const wasLayoutPending = useRef(false);
  const progressStart = useRef<number | null>(null);

  const layoutSignature = useMemo(() => {
    const nodeIds = allNodes.map((node) => node.id).join(",");
    const boolIds = boolNodes.map((node) => node.id).join(",");
    const edgeKeys = edges.map((edge) => `${edge.from}|${edge.to}|${edge.kind}`).join(",");
    const visibility = [...nodeVisibility.entries()]
      .map(([id, visible]) => (visible ? id : `!${id}`))
      .join(",");
    return fnv1a(
      `${viewportWidth}x${viewportHeight}::${nodeIds}::${boolIds}::${edgeKeys}::${visibility}`,
      { size: 64 },
    ).toString(36);
  }, [allNodes, boolNodes, edges, nodeVisibility, viewportWidth, viewportHeight]);

  const lastLayoutSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastLayoutSignature.current === layoutSignature) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const cached = getCachedLayout(layoutSignature);
      if (cached) {
        lastLayoutSignature.current = layoutSignature;
        setLaidOut(cached);
        setLayoutPending(false);
        return;
      }
      setLayoutPending(true);
      layoutGraph(allNodes, boolNodes, edges, {
        nodeVisibility,
        viewportWidth: viewportWidth || undefined,
        viewportHeight: viewportHeight || undefined,
      })
        .then((result) => {
          if (cancelled) return;
          lastLayoutSignature.current = layoutSignature;
          setCachedLayout(layoutSignature, result);
          setLayoutProgress(1);
          window.setTimeout(() => {
            if (cancelled) return;
            setLaidOut(result);
            setLayoutPending(false);
          }, 250);
        })
        .catch(() => {
          if (!cancelled) setLayoutPending(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [allNodes, boolNodes, edges, layoutSignature, nodeVisibility, viewportWidth, viewportHeight]);

  useEffect(() => {
    onLayoutPendingChange?.(layoutPending);
  }, [layoutPending, onLayoutPendingChange]);

  const flowInstance = useRef<ReactFlowInstance | null>(null);
  const lastFitKey = useRef(fitViewKey);
  const fitPending = useRef(false);
  const fitStaleSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastFitKey.current === fitViewKey) return;
    lastFitKey.current = fitViewKey;
    fitPending.current = true;
    fitStaleSignature.current = lastLayoutSignature.current;
  }, [fitViewKey]);

  useEffect(() => {
    if (!fitPending.current || !laidOut) return;
    if (lastLayoutSignature.current !== layoutSignature) return;
    if (layoutSignature === fitStaleSignature.current) return;
    fitPending.current = false;
    const frame = requestAnimationFrame(() => {
      void flowInstance.current?.fitView({ padding: 0.25, duration: 400 });
    });
    return () => cancelAnimationFrame(frame);
  }, [laidOut, layoutSignature, fitViewKey]);

  useEffect(() => {
    if (layoutPending) {
      wasLayoutPending.current = true;
      if (progressStart.current === null) progressStart.current = performance.now();
      const advance = () => {
        setProgressVisible(true);
        const elapsed = (performance.now() - (progressStart.current ?? 0)) / 1000;
        setLayoutProgress((current) => Math.max(current, progressBarLoadingCourses(elapsed)));
      };
      const first = window.setTimeout(advance, 0);
      const tick = window.setInterval(advance, 100);
      return () => {
        window.clearTimeout(first);
        window.clearInterval(tick);
      };
    }

    if (!wasLayoutPending.current) return;
    wasLayoutPending.current = false;
    progressStart.current = null;
    const fill = window.setTimeout(() => setLayoutProgress(1), 0);
    const hide = window.setTimeout(() => {
      setProgressVisible(false);
      setLayoutProgress(0);
    }, 350);
    return () => {
      window.clearTimeout(fill);
      window.clearTimeout(hide);
    };
  }, [layoutPending]);

  const courseById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of allNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [allNodes]);

  const edgeIds = useMemo(
    () => new Set((laidOut?.edges ?? []).map((edge) => edge.id)),
    [laidOut],
  );

  const boolNodeInfo = useMemo(() => {
    const operatorById = new Map(boolNodes.map((node) => [node.id, node.operator]));
    const label = (id: string) => courseById.get(id)?.code ?? id;

    const describe = (id: string, depth: number): string => {
      const operator = operatorById.get(id);
      if (!operator) return label(id);
      if (depth >= 2) return "…";
      const parts = (edgeIndex.incoming.get(id) ?? []).map((edge) =>
        describe(edge.from, depth + 1),
      );
      return `(${parts.join(operator === "or" ? " or " : " and ")})`;
    };

    const unlocksOf = (id: string): string[] => {
      const result: string[] = [];
      const visited = new Set([id]);
      const stack = [id];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const edge of edgeIndex.outgoing.get(current) ?? []) {
          if (visited.has(edge.to)) continue;
          visited.add(edge.to);
          if (operatorById.has(edge.to)) {
            stack.push(edge.to);
          } else {
            result.push(label(edge.to));
          }
        }
      }
      return result;
    };

    const map = new Map<string, { inputs: string[]; unlocks: string[] }>();
    for (const boolNode of boolNodes) {
      const inputs = (edgeIndex.incoming.get(boolNode.id) ?? []).map((edge) =>
        describe(edge.from, 0),
      );
      map.set(boolNode.id, { inputs, unlocks: unlocksOf(boolNode.id) });
    }
    return map;
  }, [boolNodes, courseById, edgeIndex]);

  const [styleNode] = useState(() => createStyleCache<Node>());
  const [styleEdge] = useState(() => createStyleCache<Edge>());

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!laidOut) return { nodes: [] as Node[], edges: [] as Edge[] };
    const isHovering = hoverPathNodeId !== null;

    const styledNodes: Node[] = laidOut.nodes.map((node) => {
      const visible = nodeVisibility.get(node.id) ?? false;
      const hoverHighlighted = hoverHighlightedNodeIds.has(node.id);
      const selectionHighlighted = selectionHighlightedNodeIds.has(node.id);
      const highlighted = hoverHighlighted || selectionHighlighted;

      if (node.type === "bool") {
        const boolSelected = visible && selectedNodeIdSet.has(node.id);
        const info = boolNodeInfo.get(node.id);
        return styleNode(node.id, [node, visible, highlighted, hoverHighlighted, boolSelected, info], () => ({
          ...node,
          zIndex: highlighted || boolSelected ? 20 : 10,
          className: hoverHighlighted ? "spotlit" : undefined,
          style: {
            opacity: visible ? undefined : 0,
            pointerEvents: visible ? "auto" : "none",
          },
          selectable: false,
          focusable: visible,
          data: {
            ...(node.data as object),
            highlighted: visible && highlighted,
            selected: boolSelected,
            visible,
            inputs: info?.inputs,
            unlocks: info?.unlocks,
          },
        }));
      }

      const course =
        courseById.get(node.id) ?? (node.data as { course?: GraphNode }).course;
      const selected = visible && selectedNodeIdSet.has(node.id);
      const diff = diffMap?.get(node.id) ?? null;
      const nodeRoles = roleMap.get(node.id);
      const roleTint: "prerequisite" | "postrequisite" | null = nodeRoles?.has("postrequisite")
        ? "postrequisite"
        : nodeRoles?.has("prerequisite") || nodeRoles?.has("requiredPrerequisite")
          ? "prerequisite"
          : null;
      const deps = [
        node,
        course,
        visible,
        selected,
        highlighted,
        hoverHighlighted,
        diff,
        roleTint,
        settings.showNoPrerequisites,
        onAddCourse,
        onOpenCourseInfo,
        onHideCourse,
      ];

      return styleNode(node.id, deps, () => ({
        ...node,
        zIndex: 5,
        className: hoverHighlighted ? "spotlit" : undefined,
        style: {
          opacity: visible ? undefined : 0,
          pointerEvents: visible ? "auto" : "none",
        },
        selectable: visible,
        focusable: visible,
        data: {
          ...(node.data as object),
          course,
          selected,
          highlighted: visible && highlighted,
          diff,
          roleTint,
          showNoPrerequisites: settings.showNoPrerequisites,
          visible,
          onAdd: onAddCourse,
          onOpenInfo: onOpenCourseInfo,
          onHide: onHideCourse,
        },
      }));
    });

    const styledEdges: Edge[] = [];
    for (const edge of laidOut.edges) {
      const kind = (edge.data as { kind?: GraphEdge["kind"] } | undefined)?.kind ?? "postrequisite";
      const sourceVisible = nodeVisibility.get(edge.source) ?? false;
      const targetVisible = nodeVisibility.get(edge.target) ?? false;
      const visible = sourceVisible && targetVisible;
      const hiddenByCompression = laidOut.hiddenEdgeKeys.has(edge.id);
      const bidirectional = kind === "corequisite" || kind === "exclusion";
      const hasReverseEdge = bidirectional && edgeIds.has(`${edge.target}|${edge.source}|${kind}`);
      const hiddenAsReverseDuplicate = hasReverseEdge && edge.source > edge.target;
      if (!visible || hiddenByCompression || hiddenAsReverseDuplicate || hiddenEdgeKindSet.has(kind)) {
        continue;
      }
      const hoverHighlighted =
        isHovering &&
        visible &&
        ((pathEdgeKinds.has(kind) && hoverHighlightedNodeIds.has(edge.source) && hoverHighlightedNodeIds.has(edge.target)) ||
          ((kind === "corequisite" || kind === "exclusion") &&
            ((edge.source === hoverPathNodeId && hoverDirectRelatedNodeIds.has(edge.target)) ||
              (edge.target === hoverPathNodeId && hoverDirectRelatedNodeIds.has(edge.source)))));
      const selectionHighlighted =
        visible &&
        ((pathEdgeKinds.has(kind) &&
          selectionHighlightSets.some(
            (set) => set.has(edge.source) && set.has(edge.target),
          )) ||
          ((kind === "corequisite" || kind === "exclusion") &&
            selectedNodeIds.some(
              (nodeId, index) =>
                (edge.source === nodeId && selectionDirectRelatedSets[index].has(edge.target)) ||
                (edge.target === nodeId && selectionDirectRelatedSets[index].has(edge.source)),
            )));
      const highlighted = hoverHighlighted || selectionHighlighted;
      const markerColor = edgeMarkerColor(kind, dark, highlighted);
      const deps = [edge, highlighted, hoverHighlighted, hasReverseEdge, dark];

      styledEdges.push(
        styleEdge(edge.id, deps, () => {
          const baseStyle = edgeStyle(kind, dark, highlighted);

          return {
            ...edge,
            className: hoverHighlighted ? "spotlit" : undefined,
            style: {
              ...baseStyle,
              opacity: highlighted ? 1 : DEFAULT_EDGE_OPACITY,
            },
            markerStart: hasReverseEdge
              ? { type: "arrowclosed" as const, color: markerColor }
              : undefined,
            markerEnd: { type: "arrowclosed" as const, color: markerColor },
            zIndex: highlighted ? 2 : 0,
          };
        }),
      );
    }

    return { nodes: styledNodes, edges: styledEdges };
  }, [
    laidOut,
    boolNodeInfo,
    courseById,
    dark,
    diffMap,
    edgeIds,
    hiddenEdgeKindSet,
    hoverHighlightedNodeIds,
    hoverDirectRelatedNodeIds,
    hoverPathNodeId,
    nodeVisibility,
    onAddCourse,
    onOpenCourseInfo,
    onHideCourse,
    roleMap,
    selectedNodeIds,
    selectedNodeIdSet,
    selectionDirectRelatedSets,
    selectionHighlightedNodeIds,
    selectionHighlightSets,
    settings,
    pathEdgeKinds,
    styleNode,
    styleEdge,
  ]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const visible = (node.data as { visible?: boolean }).visible ?? true;
      if (!visible) return;
      onSelectNode(node.id);
    },
    [onSelectNode],
  );


  const setSpotlight = useCallback((id: string | null) => {
    spotlightIdRef.current = id;
    setSpotlightNodeId(id);
  }, []);

  const clearSpotlightTimer = useCallback(() => {
    if (spotlightTimer.current !== null) {
      window.clearTimeout(spotlightTimer.current);
      spotlightTimer.current = null;
    }
  }, []);

  const viewportMoving = useRef(false);

  const onMoveStart = useCallback(() => {
    viewportMoving.current = true;
    clearSpotlightTimer();
  }, [clearSpotlightTimer]);

  const onMoveEnd = useCallback(() => {
    viewportMoving.current = false;
  }, []);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (viewportMoving.current) return;
      const visible = (node.data as { visible?: boolean }).visible ?? true;
      if (!visible || (node.type !== "course" && node.type !== "bool")) return;
      clearSpotlightTimer();
      const delay = spotlightIdRef.current !== null ? 100 : 200;
      spotlightTimer.current = window.setTimeout(() => {
        spotlightTimer.current = null;
        setSpotlight(node.id);
      }, delay);
    },
    [clearSpotlightTimer, setSpotlight],
  );

  const onNodeMouseLeave = useCallback(() => {
    clearSpotlightTimer();
    if (spotlightIdRef.current !== null) {
      spotlightTimer.current = window.setTimeout(() => {
        spotlightTimer.current = null;
        setSpotlight(null);
      }, 200);
    }
  }, [clearSpotlightTimer, setSpotlight]);

  useEffect(() => clearSpotlightTimer, [clearSpotlightTimer]);

  const onPaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .react-flow__controls button {
        background: ${dark ? "var(--color-panel)" : "var(--color-surface)"};
        border-color: ${dark ? "var(--color-control-border-dark)" : "var(--color-control-border)"};
        color: ${dark ? "var(--color-control-text-dark)" : "var(--color-control-text)"};
      }
      .react-flow__controls button:hover {
        background: ${dark ? "var(--color-input)" : "var(--color-control-hover)"};
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [dark]);

  if (allNodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 bg-canvas dark:bg-base"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={[
        "course-graph absolute inset-0 bg-canvas dark:bg-base",
        hoverPathNodeId !== null ? "spotlighting" : "",
      ].join(" ")}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onInit={(instance) => {
          flowInstance.current = instance;
        }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onlyRenderVisibleElements={flowNodes.length > CULL_OFFSCREEN_NODE_COUNT}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color={dark ? "var(--color-canvas-dots-dark)" : "var(--color-canvas-dots)"} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {progressVisible && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            role="status"
            aria-live="polite"
            className="flex w-56 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-surface/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-input/95"
          >
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Loading graph…
            </div>
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-[width] duration-200 ease-out dark:bg-blue-400"
                style={{ width: `${Math.round(layoutProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
