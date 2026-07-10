import ELK, { type ElkNode, type ElkPort, type ElkExtendedEdge } from "elkjs/lib/elk-api.js";
import type { Edge, Node } from "@xyflow/react";
import type { BoolGraphNode, GraphEdge, GraphNode } from "../types/graph";
import { roundedPath, type Point } from "./edgeRouting";

const COURSE_NODE_WIDTH = 180;
const COURSE_NODE_HEIGHT = 72;
const BOOL_NODE_WIDTH = 48;
const BOOL_NODE_HEIGHT = 32;
const NODE_SEP = 32;
const RANK_SEP = 72;
const MARGIN_X = 32;
const MARGIN_Y = 32;
const ISOLATED_GRID_MIN_COLUMNS = 6;
const ISOLATED_GRID_MAX_COLUMNS = 14;
const DEFAULT_MAX_WIDTH = 1400;
const DEFAULT_MAX_HEIGHT = 900;

type Side = "north" | "south" | "east" | "west";

type LayoutOptions = {
  nodeVisibility: Map<string, boolean>;
  viewportWidth?: number;
  viewportHeight?: number;
};

type LayoutResult = {
  nodes: Node[];
  edges: Edge[];
  hiddenEdgeKeys: Set<string>;
};

const elk = new ELK({
  workerFactory: () =>
    new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url)),
});

function edgeKey(edge: Pick<GraphEdge, "from" | "to" | "kind">) {
  return `${edge.from}|${edge.to}|${edge.kind}`;
}

function portId(nodeId: string, side: Side) {
  return `${nodeId}::${side}`;
}

function nodeDimensions(id: string, boolNodeIds: Set<string>) {
  if (boolNodeIds.has(id)) {
    return { width: BOOL_NODE_WIDTH, height: BOOL_NODE_HEIGHT };
  }
  return { width: COURSE_NODE_WIDTH, height: COURSE_NODE_HEIGHT };
}

function nodePorts(id: string, boolNodeIds: Set<string>): ElkPort[] {
  const { width, height } = nodeDimensions(id, boolNodeIds);
  const north: ElkPort = { id: portId(id, "north"), x: width / 2, y: 0, width: 0, height: 0 };
  const south: ElkPort = { id: portId(id, "south"), x: width / 2, y: height, width: 0, height: 0 };
  if (boolNodeIds.has(id)) {
    return [north, south];
  }
  return [
    north,
    south,
    { id: portId(id, "east"), x: width, y: height / 2, width: 0, height: 0 },
    { id: portId(id, "west"), x: 0, y: height / 2, width: 0, height: 0 },
  ];
}

function edgePorts(kind: GraphEdge["kind"]): { source: Side; target: Side } {
  if (kind === "exclusion") {
    return { source: "east", target: "west" };
  }
  return { source: "south", target: "north" };
}

function isLayoutEdge(edge: GraphEdge): boolean {
  switch (edge.kind) {
    case "postrequisite":
    case "corequisite":
    case "exclusion":
      return true;
    case "prerequisite":
      return true;
    default:
      return false;
  }
}

function compressPassthroughToBool(
  edges: GraphEdge[],
  boolNodeIds: Set<string>,
): { syntheticEdges: GraphEdge[]; hiddenEdgeKeys: Set<string> } {
  const hiddenEdgeKeys = new Set<string>();
  const syntheticEdges: GraphEdge[] = [];
  const postEdges = edges.filter((edge) => edge.kind === "postrequisite");

  const outgoing = new Map<string, GraphEdge[]>();
  const incoming = new Map<string, GraphEdge[]>();
  for (const edge of postEdges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
  }

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

      if (!syntheticEdges.some((edge) => edge.from === ancestorId && edge.to === orId)) {
        syntheticEdges.push({ from: ancestorId, to: orId, kind: "postrequisite" });
      }
    }
  }

  return { syntheticEdges, hiddenEdgeKeys };
}

function hideRedundantFanoutEdgesViaBoolNodes(
  visibleEdges: GraphEdge[],
  boolNodes: BoolGraphNode[],
  boolNodeIds: Set<string>,
): Set<string> {
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

function layoutIsolatedGrid(
  isolatedNodes: GraphNode[],
  startY: number,
  maxWidth: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (isolatedNodes.length === 0) return positions;

  const colWidth = COURSE_NODE_WIDTH + NODE_SEP;
  const rowHeight = COURSE_NODE_HEIGHT + RANK_SEP;

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

function elkEdgePoints(edge: ElkExtendedEdge): Point[] | null {
  const section = edge.sections?.[0];
  if (!section) return null;
  return [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
}

export async function layoutGraph(
  nodes: GraphNode[],
  boolNodes: BoolGraphNode[],
  edges: GraphEdge[],
  options: LayoutOptions,
): Promise<LayoutResult> {
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
      isLayoutEdge(edge) &&
      layoutNodeIds.has(edge.from) &&
      layoutNodeIds.has(edge.to),
  );

  const { syntheticEdges, hiddenEdgeKeys: compressedHidden } = compressPassthroughToBool(
    visibleEdges,
    boolNodeIds,
  );
  const redundantHidden = hideRedundantFanoutEdgesViaBoolNodes(
    visibleEdges,
    layoutBoolNodes,
    boolNodeIds,
  );
  const hiddenEdgeKeys = new Set<string>([...compressedHidden, ...redundantHidden]);

  const renderEdges = visibleEdges.filter((edge) => !hiddenEdgeKeys.has(edgeKey(edge)));

  const connectedIds = new Set<string>();
  for (const edge of visibleEdges) {
    connectedIds.add(edge.from);
    connectedIds.add(edge.to);
  }
  const elkCourseNodes = layoutNodes.filter((node) => connectedIds.has(node.id));
  const isolatedNodes = layoutNodes.filter((node) => !connectedIds.has(node.id));

  const maxWidth = Math.max(
    COURSE_NODE_WIDTH * 2 + NODE_SEP,
    (options.viewportWidth ?? DEFAULT_MAX_WIDTH) - MARGIN_X * 2,
  );
  const maxHeight = Math.max(
    COURSE_NODE_HEIGHT * 2 + RANK_SEP,
    (options.viewportHeight ?? DEFAULT_MAX_HEIGHT) - MARGIN_Y * 2,
  );
  const aspectRatio = Math.min(Math.max(maxWidth / maxHeight, 0.5), 3);

  const positions = new Map<string, { x: number; y: number }>();
  const pathById = new Map<string, string>();

  const hasElkGraph = elkCourseNodes.length + layoutBoolNodes.length > 0;

  if (hasElkGraph) {
    const children: ElkNode[] = [
      ...elkCourseNodes.map((node) => {
        const { width, height } = nodeDimensions(node.id, boolNodeIds);
        return {
          id: node.id,
          width,
          height,
          ports: nodePorts(node.id, boolNodeIds),
          layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        };
      }),
      ...layoutBoolNodes.map((boolNode) => {
        const { width, height } = nodeDimensions(boolNode.id, boolNodeIds);
        return {
          id: boolNode.id,
          width,
          height,
          ports: nodePorts(boolNode.id, boolNodeIds),
          layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        };
      }),
    ];

    const elkEdges: ElkExtendedEdge[] = [
      ...renderEdges.map((edge) => {
        const { source, target } = edgePorts(edge.kind);
        return {
          id: edgeKey(edge),
          sources: [portId(edge.from, source)],
          targets: [portId(edge.to, target)],
        };
      }),
      ...syntheticEdges.map((edge, index) => {
        const { source, target } = edgePorts(edge.kind);
        return {
          id: `syn::${index}::${edge.from}|${edge.to}`,
          sources: [portId(edge.from, source)],
          targets: [portId(edge.to, target)],
        };
      }),
    ];

    const elkGraph: ElkNode = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.aspectRatio": String(aspectRatio),
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
        "elk.layered.spacing.nodeNodeBetweenLayers": String(RANK_SEP),
        "elk.spacing.nodeNode": String(NODE_SEP),
        "elk.spacing.edgeNode": "24",
        "elk.spacing.edgeEdge": "12",
        "elk.layered.spacing.edgeNodeBetweenLayers": "24",
        "elk.layered.spacing.edgeEdgeBetweenLayers": "12",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.separateConnectedComponents": "true",
        "elk.spacing.componentComponent": "48",
        "elk.padding": `[top=${MARGIN_Y},left=${MARGIN_X},bottom=${MARGIN_Y},right=${MARGIN_X}]`,
      },
      children,
      edges: elkEdges,
    };

    const result = await elk.layout(elkGraph);

    for (const child of result.children ?? []) {
      positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 });
    }

    for (const edge of result.edges ?? []) {
      if (edge.id.startsWith("syn::")) continue;
      const points = elkEdgePoints(edge);
      if (points) {
        pathById.set(edge.id, roundedPath(points));
      }
    }
  }

  let maxBottom = 0;
  for (const [id, position] of positions) {
    const { height } = nodeDimensions(id, boolNodeIds);
    maxBottom = Math.max(maxBottom, position.y + height);
  }

  const isolatedStartY = hasElkGraph ? maxBottom + RANK_SEP : MARGIN_Y;
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

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edgeKey(edge),
    source: edge.from,
    target: edge.to,
    type: "course",
    data: { kind: edge.kind, path: pathById.get(edgeKey(edge)) },
  }));

  return { nodes: flowNodes, edges: flowEdges, hiddenEdgeKeys };
}

export { edgeKey as graphEdgeKey };
