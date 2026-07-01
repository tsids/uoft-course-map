import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { defaultSettings, type SettingsState } from "../types/filters";
import type { BoolGraphNode, GraphEdge, GraphNode } from "../types/graph";

const COURSE_NODE_WIDTH = 180;
const COURSE_NODE_HEIGHT = 72;
const BOOL_NODE_WIDTH = 48;
const BOOL_NODE_HEIGHT = 32;
const NODE_SEP = 40;
const EDGE_SEP = 20;
const RANK_SEP = 72;
const MARGIN_X = 32;
const MARGIN_Y = 32;
const ISOLATED_GRID_MIN_COLUMNS = 6;
const ISOLATED_GRID_MAX_COLUMNS = 14;
/** Fallback drawing width (px) used when the caller doesn't provide the viewport size. */
const DEFAULT_MAX_WIDTH = 1400;
/** Vertical gap between wrapped rows that belong to the same rank. */
const WRAP_ROW_GAP = RANK_SEP;

type LayoutOptions = {
  nodeVisibility: Map<string, boolean>;
  settings?: SettingsState;
  /** Available drawing width in px; wide ranks wrap to stay within it. */
  viewportWidth?: number;
};

type LayoutResult = {
  nodes: Node[];
  edges: Edge[];
  hiddenEdgeKeys: Set<string>;
};

function edgeKey(edge: Pick<GraphEdge, "from" | "to" | "kind">) {
  return `${edge.from}|${edge.to}|${edge.kind}`;
}

function nodeDimensions(id: string, boolNodeIds: Set<string>) {
  if (boolNodeIds.has(id)) {
    return { width: BOOL_NODE_WIDTH, height: BOOL_NODE_HEIGHT };
  }
  return { width: COURSE_NODE_WIDTH, height: COURSE_NODE_HEIGHT };
}

function nodeCenterX(id: string, x: number, boolNodeIds: Set<string>) {
  const { width } = nodeDimensions(id, boolNodeIds);
  return x + width / 2;
}

function isLayoutEdge(edge: GraphEdge, settings: SettingsState): boolean {
  switch (edge.kind) {
    case "postrequisite":
    case "corequisite":
    case "exclusion":
      // Chains and AND/OR connectors are always shown for the graph.
      return true;
    case "prerequisite":
      // Only the selected courses' own upward prerequisite edges are gated.
      return settings.showPrerequisites;
    default:
      return false;
  }
}

/** Collapse A -> B -> OR into A -> OR so the connector sits on the main spine. */
function compressPassthroughToBool(
  edges: GraphEdge[],
  boolNodeIds: Set<string>,
): { layoutEdges: GraphEdge[]; hiddenEdgeKeys: Set<string> } {
  const hiddenEdgeKeys = new Set<string>();
  const postEdges = edges.filter((edge) => edge.kind === "postrequisite");

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of postEdges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  }

  const layoutEdges = [...postEdges];

  for (const orId of boolNodeIds) {
    const inputsToOr = (incoming.get(orId) ?? []).filter((edge) => !boolNodeIds.has(edge.from));

    for (const inputEdge of inputsToOr) {
      const passthroughId = inputEdge.from;
      const intoPassthrough = (incoming.get(passthroughId) ?? []).filter(
        (edge) => edge.kind === "postrequisite" && !boolNodeIds.has(edge.from),
      );
      const outOfPassthrough = (outgoing.get(passthroughId) ?? []).filter(
        (edge) => edge.kind === "postrequisite",
      );

      if (intoPassthrough.length !== 1 || outOfPassthrough.length !== 1) continue;
      if (outOfPassthrough[0]?.to !== orId) continue;

      const ancestorId = intoPassthrough[0]!.from;
      hiddenEdgeKeys.add(edgeKey({ from: ancestorId, to: passthroughId, kind: "postrequisite" }));

      if (!layoutEdges.some((edge) => edge.from === ancestorId && edge.to === orId)) {
        layoutEdges.push({ from: ancestorId, to: orId, kind: "postrequisite" });
      }
    }
  }

  const filteredLayoutEdges = layoutEdges.filter((edge) => !hiddenEdgeKeys.has(edgeKey(edge)));

  return { layoutEdges: filteredLayoutEdges, hiddenEdgeKeys };
}

function centerBoolNodes(
  positions: Map<string, { x: number; y: number }>,
  visualEdges: GraphEdge[],
  boolNodeIds: Set<string>,
) {
  for (const boolId of boolNodeIds) {
    const position = positions.get(boolId);
    if (!position) continue;

    const inputs = visualEdges
      .filter((edge) => edge.to === boolId && edge.kind === "postrequisite")
      .map((edge) => edge.from);
    const inputIds = inputs.filter((id) => positions.has(id));

    if (inputIds.length > 0) {
      const centers = inputIds.map((id) => nodeCenterX(id, positions.get(id)!.x, boolNodeIds));
      const centerX = (Math.min(...centers) + Math.max(...centers)) / 2;
      positions.set(boolId, { ...position, x: centerX - BOOL_NODE_WIDTH / 2 });
      continue;
    }

    const parentEdge = visualEdges.find((edge) => edge.to === boolId);
    if (parentEdge && positions.has(parentEdge.from)) {
      const parentCenter = nodeCenterX(
        parentEdge.from,
        positions.get(parentEdge.from)!.x,
        boolNodeIds,
      );
      positions.set(boolId, { ...position, x: parentCenter - BOOL_NODE_WIDTH / 2 });
    }
  }
}

type Side = "top" | "bottom" | "left" | "right";

type Point = { x: number; y: number };

type AnchorPlan = {
  edge: Edge;
  sourceSide: Side;
  targetSide: Side;
};

function nodeAnchorPoints(
  id: string,
  positions: Map<string, { x: number; y: number }>,
  boolNodeIds: Set<string>,
): Record<Side, Point> {
  const position = positions.get(id) ?? { x: 0, y: 0 };
  const { width, height } = nodeDimensions(id, boolNodeIds);
  const centerX = position.x + width / 2;
  const centerY = position.y + height / 2;

  return {
    top: { x: centerX, y: position.y },
    bottom: { x: centerX, y: position.y + height },
    left: { x: position.x, y: centerY },
    right: { x: position.x + width, y: centerY },
  };
}

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function nodeCenter(
  id: string,
  positions: Map<string, { x: number; y: number }>,
  boolNodeIds: Set<string>,
): Point {
  const position = positions.get(id) ?? { x: 0, y: 0 };
  const { width, height } = nodeDimensions(id, boolNodeIds);
  return { x: position.x + width / 2, y: position.y + height / 2 };
}

/**
 * Pick reasonable source/target sides for an orthogonal "L".
 *
 * The previous "closest midpoint" approach often selects `targetSide="left"` for
 * far-apart nodes, even when the edge clearly comes from above (like the spine
 * above a row of courses). We bias the target side based on relative vertical
 * direction so endpoints look intuitive.
 */
function pickBestSides(
  sourceId: string,
  targetId: string,
  positions: Map<string, { x: number; y: number }>,
  boolNodeIds: Set<string>,
): { sourceSide: Side; targetSide: Side } {
  const sourceCenter = nodeCenter(sourceId, positions, boolNodeIds);
  const targetCenter = nodeCenter(targetId, positions, boolNodeIds);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  // Strong preference for entering from the top/bottom when there is a clear vertical order.
  let targetSide: Side;
  if (dy > 0) targetSide = "top";
  else if (dy < 0) targetSide = "bottom";
  else targetSide = dx >= 0 ? "left" : "right";

  // For the source, prefer moving toward the target (right/left), unless it's mostly vertical.
  const mostlyVertical = Math.abs(dy) > Math.abs(dx) * 0.6;
  let sourceSide: Side;
  if (mostlyVertical) {
    sourceSide = dy >= 0 ? "bottom" : "top";
  } else {
    sourceSide = dx >= 0 ? "right" : "left";
  }

  // Final tie-break: if the heuristic makes something obviously worse in tight cases,
  // fall back to the closest-pair search while keeping the biased target side fixed.
  const sourceAnchors = nodeAnchorPoints(sourceId, positions, boolNodeIds);
  const targetAnchors = nodeAnchorPoints(targetId, positions, boolNodeIds);
  const preferredDistance = dist(sourceAnchors[sourceSide], targetAnchors[targetSide]);

  const allSides: Side[] = ["top", "bottom", "left", "right"];
  let bestSource = sourceSide;
  let bestDist = preferredDistance;
  for (const candidate of allSides) {
    const d = dist(sourceAnchors[candidate], targetAnchors[targetSide]);
    if (d < bestDist) {
      bestDist = d;
      bestSource = candidate;
    }
  }

  return { sourceSide: bestSource, targetSide };
}

function anchorOnSide(
  side: Side,
  slot: number,
  total: number,
  position: { x: number; y: number },
  width: number,
  height: number,
): Point {
  const ratio = total <= 1 ? 0.5 : (slot + 1) / (total + 1);

  switch (side) {
    case "top":
      return { x: position.x + width * ratio, y: position.y };
    case "bottom":
      return { x: position.x + width * ratio, y: position.y + height };
    case "left":
      return { x: position.x, y: position.y + height * ratio };
    case "right":
      return { x: position.x + width, y: position.y + height * ratio };
  }
}

function assignEdgeAnchors(
  flowEdges: Edge[],
  positions: Map<string, { x: number; y: number }>,
  boolNodeIds: Set<string>,
): Edge[] {
  const plans: AnchorPlan[] = flowEdges.map((edge) => ({
    edge,
    ...pickBestSides(edge.source, edge.target, positions, boolNodeIds),
  }));

  const sourcesWithBoolTargets = new Set<string>();
  for (const plan of plans) {
    if (boolNodeIds.has(plan.edge.target)) {
      sourcesWithBoolTargets.add(plan.edge.source);
    }
  }

  const sourceGroups = new Map<string, AnchorPlan[]>();
  const targetGroups = new Map<string, AnchorPlan[]>();

  for (const plan of plans) {
    const sourceKey = `${plan.edge.source}|${plan.sourceSide}`;
    sourceGroups.set(sourceKey, [...(sourceGroups.get(sourceKey) ?? []), plan]);

    const targetKey = `${plan.edge.target}|${plan.targetSide}`;
    targetGroups.set(targetKey, [...(targetGroups.get(targetKey) ?? []), plan]);
  }

  const nodeSortKey = (nodeId: string) => nodeCenterX(nodeId, positions.get(nodeId)?.x ?? 0, boolNodeIds);

  for (const group of sourceGroups.values()) {
    group.sort((a, b) => nodeSortKey(a.edge.target) - nodeSortKey(b.edge.target));
    group.forEach((plan, slot) => {
      const position = positions.get(plan.edge.source);
      if (!position) return;
      const { width, height } = nodeDimensions(plan.edge.source, boolNodeIds);
      // When a node fans out into a bool connector (OR/AND), we prefer a single
      // shared stem out of the source so it doesn't look like multiple arrows
      // are "going into" the connector due to overlapping first segments.
      const collapseStem =
        plan.sourceSide === "bottom" &&
        group.length > 1 &&
        !boolNodeIds.has(plan.edge.source) &&
        sourcesWithBoolTargets.has(plan.edge.source);
      const anchor = collapseStem
        ? anchorOnSide(plan.sourceSide, 0, 1, position, width, height)
        : anchorOnSide(plan.sourceSide, slot, group.length, position, width, height);
      plan.edge.data = {
        ...(plan.edge.data as object),
        sourceAnchor: [anchor.x, anchor.y] as [number, number],
        sourceSide: plan.sourceSide,
      };
    });
  }

  for (const group of targetGroups.values()) {
    group.sort((a, b) => nodeSortKey(a.edge.source) - nodeSortKey(b.edge.source));
    group.forEach((plan, slot) => {
      const position = positions.get(plan.edge.target);
      if (!position) return;
      const { width, height } = nodeDimensions(plan.edge.target, boolNodeIds);
      const anchor = anchorOnSide(plan.targetSide, slot, group.length, position, width, height);
      plan.edge.data = {
        ...(plan.edge.data as object),
        targetAnchor: [anchor.x, anchor.y] as [number, number],
        targetSide: plan.targetSide,
      };
    });
  }

  return flowEdges;
}

function centerRootNodesOverChildren(
  positions: Map<string, { x: number; y: number }>,
  visualEdges: GraphEdge[],
  boolNodeIds: Set<string>,
) {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const edge of visualEdges) {
    if (edge.kind !== "postrequisite") continue;
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  for (const [nodeId, position] of positions.entries()) {
    if (boolNodeIds.has(nodeId)) continue;
    if ((incoming.get(nodeId) ?? 0) > 0) continue; // not a root in the postrequisite backbone

    const children = (outgoing.get(nodeId) ?? []).filter((childId) => positions.has(childId));
    if (children.length === 0) continue;

    const centers = children.map((id) => nodeCenterX(id, positions.get(id)!.x, boolNodeIds));
    const centerX = (Math.min(...centers) + Math.max(...centers)) / 2;
    const { width } = nodeDimensions(nodeId, boolNodeIds);
    positions.set(nodeId, { ...position, x: centerX - width / 2 });
  }
}

function hideRedundantFanoutEdgesViaBoolNodes(
  visibleEdges: GraphEdge[],
  boolNodes: BoolGraphNode[],
  boolNodeIds: Set<string>,
): Set<string> {
  // If we have: Course A -> (or) B -> {C1, C2, ...}
  // then the direct edges A -> Ci are visually redundant and create stacked stubs.
  // Hide A -> Ci (postrequisite) and keep A -> B plus B -> Ci.
  const hidden = new Set<string>();

  const incoming = new Map<string, GraphEdge[]>();
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of visibleEdges) {
    if (edge.kind !== "postrequisite") continue;
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }

  const byKey = new Set<string>(visibleEdges.map((edge) => edgeKey(edge)));

  for (const boolNode of boolNodes) {
    if (boolNode.operator !== "or") continue;
    if (!boolNodeIds.has(boolNode.id)) continue;

    const inEdges = (incoming.get(boolNode.id) ?? []).filter((edge) => !boolNodeIds.has(edge.from));
    if (inEdges.length !== 1) continue;

    const parentId = inEdges[0]!.from;
    const outEdges = (outgoing.get(boolNode.id) ?? []).filter((edge) => !boolNodeIds.has(edge.to));
    if (outEdges.length < 2) continue;

    for (const outEdge of outEdges) {
      const childId = outEdge.to;
      const redundantKey = edgeKey({ from: parentId, to: childId, kind: "postrequisite" });
      if (byKey.has(redundantKey)) {
        hidden.add(redundantKey);
      }
    }
  }

  return hidden;
}

/**
 * Keep the drawing flowing downward instead of sideways.
 *
 * dagre places every node of a rank on a single horizontal line, so a course
 * with many postrequisites (or a wide prerequisite fan-in) becomes one extremely
 * wide row and the whole graph reads as horizontal. This pass groups nodes by
 * rank (shared center-y) and, whenever a rank is wider than `maxWidth`, wraps it
 * into several stacked rows and pushes every lower rank further down. Ranks that
 * already fit keep dagre's crossing-minimized positions untouched.
 */
function wrapWideRanks(
  positions: Map<string, { x: number; y: number }>,
  ids: string[],
  boolNodeIds: Set<string>,
  maxWidth: number,
) {
  const byRank = new Map<number, string[]>();
  for (const id of ids) {
    const position = positions.get(id);
    if (!position) continue;
    const { height } = nodeDimensions(id, boolNodeIds);
    const centerY = Math.round(position.y + height / 2);
    byRank.set(centerY, [...(byRank.get(centerY) ?? []), id]);
  }

  const rankKeys = [...byRank.keys()].sort((a, b) => a - b);
  let extraOffset = 0;

  for (const key of rankKeys) {
    const group = byRank.get(key)!;

    // Absorb the downward shift introduced by earlier wrapped ranks.
    for (const id of group) {
      const position = positions.get(id)!;
      positions.set(id, { x: position.x, y: position.y + extraOffset });
    }

    group.sort(
      (a, b) =>
        nodeCenterX(a, positions.get(a)!.x, boolNodeIds) -
        nodeCenterX(b, positions.get(b)!.x, boolNodeIds),
    );

    const totalWidth =
      group.reduce((sum, id) => sum + nodeDimensions(id, boolNodeIds).width, 0) +
      NODE_SEP * Math.max(0, group.length - 1);

    if (group.length <= 1 || totalWidth <= maxWidth) continue;

    // Greedily pack the rank into rows no wider than maxWidth.
    const rows: string[][] = [];
    let current: string[] = [];
    let currentWidth = 0;
    for (const id of group) {
      const width = nodeDimensions(id, boolNodeIds).width;
      const projected = current.length === 0 ? width : currentWidth + NODE_SEP + width;
      if (current.length > 0 && projected > maxWidth) {
        rows.push(current);
        current = [id];
        currentWidth = width;
      } else {
        current.push(id);
        currentWidth = projected;
      }
    }
    if (current.length > 0) rows.push(current);

    const centersX = group.map((id) => nodeCenterX(id, positions.get(id)!.x, boolNodeIds));
    const axisX = (Math.min(...centersX) + Math.max(...centersX)) / 2;
    const rankCenterY = key + extraOffset;
    const rowStep =
      Math.max(...group.map((id) => nodeDimensions(id, boolNodeIds).height)) + WRAP_ROW_GAP;

    rows.forEach((row, rowIndex) => {
      const rowWidth =
        row.reduce((sum, id) => sum + nodeDimensions(id, boolNodeIds).width, 0) +
        NODE_SEP * Math.max(0, row.length - 1);
      const rowCenterY = rankCenterY + rowIndex * rowStep;
      let x = axisX - rowWidth / 2;
      for (const id of row) {
        const { width, height } = nodeDimensions(id, boolNodeIds);
        positions.set(id, { x, y: rowCenterY - height / 2 });
        x += width + NODE_SEP;
      }
    });

    extraOffset += (rows.length - 1) * rowStep;
  }
}

/**
 * Nodes with no edges at all (e.g. the "show all courses with no prerequisites"
 * flood, which can add hundreds of unconnected courses) would otherwise all land
 * in a single dagre rank and stretch the graph very wide. Instead, pack them into
 * a grid that grows downward, below whatever the connected part of the graph laid out.
 */
function layoutIsolatedGrid(
  isolatedNodes: GraphNode[],
  startY: number,
  maxWidth: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (isolatedNodes.length === 0) return positions;

  const colWidth = COURSE_NODE_WIDTH + NODE_SEP;
  const rowHeight = COURSE_NODE_HEIGHT + RANK_SEP;

  // Never let the grid grow wider than the viewport: the column count is capped
  // by how many nodes actually fit across maxWidth.
  const columnsThatFit = Math.max(1, Math.floor((maxWidth + NODE_SEP) / colWidth));
  const desiredColumns = Math.max(
    ISOLATED_GRID_MIN_COLUMNS,
    Math.min(ISOLATED_GRID_MAX_COLUMNS, Math.ceil(Math.sqrt(isolatedNodes.length * 1.6))),
  );
  const columns = Math.min(desiredColumns, columnsThatFit);

  isolatedNodes.forEach((node, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions.set(node.id, {
      x: MARGIN_X + col * colWidth,
      y: startY + row * rowHeight,
    });
  });

  return positions;
}

export function layoutGraph(
  nodes: GraphNode[],
  boolNodes: BoolGraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions,
): LayoutResult {
  const settings = options.settings ?? defaultSettings;
  const { nodeVisibility } = options;

  const layoutNodes = nodes.filter((node) => nodeVisibility.get(node.id));
  const layoutBoolNodes = boolNodes.filter((node) => nodeVisibility.get(node.id));
  const layoutNodeIds = new Set([
    ...layoutNodes.map((node) => node.id),
    ...layoutBoolNodes.map((node) => node.id),
  ]);
  const boolNodeIds = new Set(layoutBoolNodes.map((node) => node.id));

  const visibleEdges = edges.filter(
    (edge) =>
      isLayoutEdge(edge, settings) &&
      layoutNodeIds.has(edge.from) &&
      layoutNodeIds.has(edge.to),
  );

  const { layoutEdges, hiddenEdgeKeys: compressedHidden } = compressPassthroughToBool(
    visibleEdges,
    boolNodeIds,
  );
  const redundantHidden = hideRedundantFanoutEdgesViaBoolNodes(visibleEdges, layoutBoolNodes, boolNodeIds);
  const hiddenEdgeKeys = new Set<string>([...compressedHidden, ...redundantHidden]);

  // Nodes with zero edges of any kind (e.g. from "show all no-prerequisite courses")
  // are excluded from the dagre graph and packed into a downward-growing grid instead,
  // so they don't stretch a single rank arbitrarily wide.
  const connectedIds = new Set<string>();
  for (const edge of visibleEdges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }
  const dagreLayoutNodes = layoutNodes.filter((node) => connectedIds.has(node.id));
  const isolatedNodes = layoutNodes.filter((node) => !connectedIds.has(node.id));

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    align: "UL",
    ranker: "network-simplex",
    nodesep: NODE_SEP,
    edgesep: EDGE_SEP,
    ranksep: RANK_SEP,
    marginx: MARGIN_X,
    marginy: MARGIN_Y,
  });

  for (const node of dagreLayoutNodes) {
    const { width, height } = nodeDimensions(node.id, boolNodeIds);
    graph.setNode(node.id, { width, height });
  }

  for (const boolNode of layoutBoolNodes) {
    const { width, height } = nodeDimensions(boolNode.id, boolNodeIds);
    graph.setNode(boolNode.id, { width, height });
  }

  // Feed dagre the full ranking backbone, not just postrequisites. Because every
  // edge points from the foundational course to the dependent one, top-to-bottom
  // ranking naturally puts prerequisites above a course and postrequisites below.
  // Exclusions are omitted since mutually exclusive courses belong on the same level.
  const rankingEdgeKeys = new Set<string>();
  const addRankingEdge = (from: string, to: string) => {
    if (from === to) return;
    const key = `${from}|${to}`;
    if (rankingEdgeKeys.has(key)) return;
    rankingEdgeKeys.add(key);
    graph.setEdge(from, to);
  };
  for (const edge of layoutEdges) addRankingEdge(edge.from, edge.to);
  for (const edge of visibleEdges) {
    if (edge.kind === "prerequisite" || edge.kind === "corequisite") {
      addRankingEdge(edge.from, edge.to);
    }
  }

  dagre.layout(graph);

  const positions = new Map<string, { x: number; y: number }>();
  let maxBottom = 0;

  for (const node of dagreLayoutNodes) {
    const layout = graph.node(node.id) ?? { x: 0, y: 0 };
    const y = layout.y - COURSE_NODE_HEIGHT / 2;
    positions.set(node.id, { x: layout.x - COURSE_NODE_WIDTH / 2, y });
    maxBottom = Math.max(maxBottom, y + COURSE_NODE_HEIGHT);
  }

  for (const boolNode of layoutBoolNodes) {
    const layout = graph.node(boolNode.id) ?? { x: 0, y: 0 };
    const y = layout.y - BOOL_NODE_HEIGHT / 2;
    positions.set(boolNode.id, { x: layout.x - BOOL_NODE_WIDTH / 2, y });
    maxBottom = Math.max(maxBottom, y + BOOL_NODE_HEIGHT);
  }

  centerBoolNodes(positions, visibleEdges, boolNodeIds);
  centerRootNodesOverChildren(positions, visibleEdges, boolNodeIds);

  // Keep the graph within the viewport width by wrapping wide ranks downward.
  const maxWidth = Math.max(
    COURSE_NODE_WIDTH * 2 + NODE_SEP,
    (options.viewportWidth ?? DEFAULT_MAX_WIDTH) - MARGIN_X * 2,
  );
  const laidOutIds = [
    ...dagreLayoutNodes.map((node) => node.id),
    ...layoutBoolNodes.map((node) => node.id),
  ];
  wrapWideRanks(positions, laidOutIds, boolNodeIds, maxWidth);

  maxBottom = 0;
  for (const id of laidOutIds) {
    const position = positions.get(id);
    if (!position) continue;
    const { height } = nodeDimensions(id, boolNodeIds);
    maxBottom = Math.max(maxBottom, position.y + height);
  }

  const isolatedStartY =
    dagreLayoutNodes.length > 0 || layoutBoolNodes.length > 0 ? maxBottom + RANK_SEP : MARGIN_Y;
  const isolatedPositions = layoutIsolatedGrid(isolatedNodes, isolatedStartY, maxWidth);
  for (const [id, position] of isolatedPositions) {
    positions.set(id, position);
  }

  const flowNodes: Node[] = [
    ...layoutNodes.map((node) => ({
      id: node.id,
      type: "course" as const,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { course: node },
    })),
    ...layoutBoolNodes.map((boolNode) => ({
      id: boolNode.id,
      type: "bool" as const,
      position: positions.get(boolNode.id) ?? { x: 0, y: 0 },
      data: { operator: boolNode.operator },
    })),
  ];

  const flowEdges: Edge[] = assignEdgeAnchors(
    edges.map((edge) => ({
      id: edgeKey(edge),
      source: edge.from,
      target: edge.to,
      type: "course",
      data: { kind: edge.kind },
    })),
    positions,
    boolNodeIds,
  );

  return { nodes: flowNodes, edges: flowEdges, hiddenEdgeKeys };
}

export { edgeKey as graphEdgeKey };
