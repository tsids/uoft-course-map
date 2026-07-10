import type {
  BoolGraphNode,
  DiffSide,
  GraphEdge,
  GraphNode,
  GraphNodeRole,
  GraphResponse,
} from "../types/graph";

export type DiffSummary = {
  onlyA: string[];
  onlyB: string[];
  shared: string[];
};

export type GraphDiff = {
  map: Map<string, DiffSide>;
  summary: DiffSummary;
};

type CanonicalGraph = {
  boolNodes: BoolGraphNode[];
  edges: GraphEdge[];
};

function canonicalizeBoolNodes(response: GraphResponse): CanonicalGraph {
  const rawBoolNodes = response.boolNodes ?? [];
  const operators = new Map(rawBoolNodes.map((node) => [node.id, node.operator]));
  const inputs = new Map<string, string[]>();

  for (const edge of response.edges) {
    if (!operators.has(edge.to)) continue;
    const list = inputs.get(edge.to) ?? [];
    list.push(edge.from);
    inputs.set(edge.to, list);
  }

  const signatures = new Map<string, string>();
  const resolving = new Set<string>();

  const signatureOf = (id: string): string => {
    if (!operators.has(id)) return id;
    const cached = signatures.get(id);
    if (cached) return cached;
    if (resolving.has(id)) return id;
    resolving.add(id);
    const children = (inputs.get(id) ?? []).map(signatureOf).sort();
    resolving.delete(id);
    const signature = `bool-${operators.get(id)}(${children.join("|")})`;
    signatures.set(id, signature);
    return signature;
  };

  const idMap = new Map<string, string>();
  for (const node of rawBoolNodes) {
    idMap.set(node.id, signatureOf(node.id));
  }

  const boolNodes: BoolGraphNode[] = [];
  const seen = new Set<string>();
  for (const node of rawBoolNodes) {
    const id = idMap.get(node.id)!;
    if (seen.has(id)) continue;
    seen.add(id);
    boolNodes.push({ id, operator: node.operator });
  }

  const edges = response.edges.map((edge) => ({
    ...edge,
    from: idMap.get(edge.from) ?? edge.from,
    to: idMap.get(edge.to) ?? edge.to,
  }));

  return { boolNodes, edges };
}

function mergeNodeFlags(primary: GraphNode, other: GraphNode): GraphNode {
  const roles = [...new Set([...(primary.roles ?? []), ...(other.roles ?? [])])] as GraphNodeRole[];
  return {
    ...primary,
    isRoot: Boolean(primary.isRoot || other.isRoot),
    roles: roles.sort(),
  };
}

type NodeCategory = "real" | "ghost" | "missing";

const CATEGORY_RANK: Record<NodeCategory, number> = { real: 0, ghost: 1, missing: 2 };

type MergedEntry = { node: GraphNode; category: NodeCategory };

const CANDIDATE_ROLES: GraphNodeRole[] = ["postrequisite", "ghost"];

const LEAF_ROLES: GraphNodeRole[] = [
  "postrequisite",
  "ghost",
  "department",
  "noPrerequisite",
  "corequisite",
  "exclusion",
];

function campusDigitOrder(rootsA: string[], rootsB: string[]): string[] {
  const order: string[] = [];
  for (const code of [...rootsA, ...rootsB, "1", "3", "5"]) {
    const digit = code.trim().slice(-1);
    if (["1", "3", "5"].includes(digit) && !order.includes(digit)) order.push(digit);
  }
  return order;
}

function pruneDanglingChains(
  merged: Map<string, MergedEntry>,
  edges: GraphEdge[],
  boolNodes: BoolGraphNode[],
): { edges: GraphEdge[]; boolNodes: BoolGraphNode[] } {
  let currentEdges = edges;
  let currentBoolNodes = boolNodes;
  for (;;) {
    const hasOutgoing = new Set(currentEdges.map((edge) => edge.from));
    const hasIncoming = new Set(currentEdges.map((edge) => edge.to));
    const removable = new Set<string>();
    for (const [id, entry] of merged) {
      if (entry.node.isRoot) continue;
      if ((entry.node.roles ?? []).some((role) => LEAF_ROLES.includes(role))) continue;
      if (!hasOutgoing.has(id)) removable.add(id);
    }
    for (const node of currentBoolNodes) {
      if (!hasOutgoing.has(node.id) || !hasIncoming.has(node.id)) removable.add(node.id);
    }
    if (removable.size === 0) {
      return { edges: currentEdges, boolNodes: currentBoolNodes };
    }
    for (const id of removable) merged.delete(id);
    currentBoolNodes = currentBoolNodes.filter((node) => !removable.has(node.id));
    currentEdges = currentEdges.filter(
      (edge) => !removable.has(edge.from) && !removable.has(edge.to),
    );
  }
}

function collapseEquivalentTwins(
  merged: Map<string, MergedEntry>,
  edges: GraphEdge[],
  boolNodes: BoolGraphNode[],
  map: Map<string, DiffSide>,
  rootsA: string[],
  rootsB: string[],
): { edges: GraphEdge[]; boolNodes: BoolGraphNode[] } {
  const exclusionKeys = new Set<string>();
  for (const edge of edges) {
    if (edge.kind === "exclusion") exclusionKeys.add(`${edge.from}|${edge.to}`);
  }
  const mutualPartners = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.kind !== "exclusion") continue;
    if (!exclusionKeys.has(`${edge.to}|${edge.from}`)) continue;
    const partners = mutualPartners.get(edge.from) ?? new Set<string>();
    partners.add(edge.to);
    mutualPartners.set(edge.from, partners);
  }
  if (mutualPartners.size === 0) return { edges, boolNodes };

  const statusOf = (id: string): string | null => {
    const entry = merged.get(id);
    if (!entry || entry.node.isRoot) return null;
    if (!(entry.node.roles ?? []).some((role) => CANDIDATE_ROLES.includes(role))) return null;
    return `${map.get(id) ?? "none"}|${entry.category}`;
  };

  const digits = campusDigitOrder(rootsA, rootsB);
  const campusRank = (id: string): number => {
    const code = merged.get(id)?.node.code ?? id;
    const index = digits.indexOf(code.trim().slice(-1));
    return index === -1 ? digits.length : index;
  };

  const candidates = [...mutualPartners.keys()]
    .filter((id) => statusOf(id) !== null)
    .sort((x, y) => campusRank(x) - campusRank(y) || x.localeCompare(y));

  const kept = new Set<string>();
  const alias = new Map<string, string>();
  for (const id of candidates) {
    const status = statusOf(id);
    const representative = [...(mutualPartners.get(id) ?? [])].find(
      (partner) => kept.has(partner) && statusOf(partner) === status,
    );
    if (representative) alias.set(id, representative);
    else kept.add(id);
  }
  if (alias.size === 0) return { edges, boolNodes };

  for (const id of alias.keys()) merged.delete(id);

  const rerouted: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    if (
      alias.has(edge.to) &&
      (edge.kind === "postrequisite" || edge.kind === "prerequisite")
    ) {
      continue;
    }
    const from = alias.get(edge.from) ?? edge.from;
    const to = alias.get(edge.to) ?? edge.to;
    if (from === to) continue;
    const key = `${from}|${to}|${edge.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rerouted.push(from === edge.from && to === edge.to ? edge : { ...edge, from, to });
  }

  return pruneDanglingChains(merged, rerouted, boolNodes);
}

function collectUnlockedIds(response: GraphResponse): Set<string> {
  const unlocked = new Set<string>();
  for (const node of response.nodes) {
    if (node.isRoot) continue;
    if (!(node.roles ?? []).includes("postrequisite")) continue;
    unlocked.add(node.id);
  }
  for (const node of response.ghostNodes ?? []) {
    unlocked.add(node.id);
  }
  return unlocked;
}

export function mergeGraphResponses(
  a: GraphResponse,
  b: GraphResponse,
): { response: GraphResponse; diff: GraphDiff } {
  const canonA = canonicalizeBoolNodes(a);
  const canonB = canonicalizeBoolNodes(b);

  const unlockedA = collectUnlockedIds(a);
  const unlockedB = collectUnlockedIds(b);

  const map = new Map<string, DiffSide>();
  const mark = (id: string, side: "a" | "b") => {
    const current = map.get(id);
    if (!current) {
      map.set(id, side);
    } else if (current !== side && current !== "both") {
      map.set(id, "both");
    }
  };

  for (const id of unlockedA) mark(id, "a");
  for (const id of unlockedB) mark(id, "b");
  for (const node of a.nodes) if (node.isRoot) mark(node.id, "a");
  for (const node of b.nodes) if (node.isRoot) mark(node.id, "b");

  const merged = new Map<string, MergedEntry>();
  const addNode = (node: GraphNode, category: NodeCategory) => {
    const existing = merged.get(node.id);
    if (!existing) {
      merged.set(node.id, { node: { ...node }, category });
      return;
    }
    if (CATEGORY_RANK[category] < CATEGORY_RANK[existing.category]) {
      merged.set(node.id, { node: mergeNodeFlags(node, existing.node), category });
    } else {
      existing.node = mergeNodeFlags(existing.node, node);
    }
  };

  for (const node of a.nodes) addNode(node, "real");
  for (const node of b.nodes) addNode(node, "real");
  for (const node of a.ghostNodes) addNode(node, "ghost");
  for (const node of b.ghostNodes) addNode(node, "ghost");
  for (const node of a.missingNodes ?? []) addNode(node, "missing");
  for (const node of b.missingNodes ?? []) addNode(node, "missing");

  const mergedBoolNodes: BoolGraphNode[] = [];
  const boolSeen = new Set<string>();
  for (const node of [...canonA.boolNodes, ...canonB.boolNodes]) {
    if (boolSeen.has(node.id)) continue;
    boolSeen.add(node.id);
    mergedBoolNodes.push(node);
  }

  const mergedEdges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const edge of [...canonA.edges, ...canonB.edges]) {
    const key = `${edge.from}|${edge.to}|${edge.kind}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    mergedEdges.push(edge);
  }

  const { edges, boolNodes } = collapseEquivalentTwins(
    merged,
    mergedEdges,
    mergedBoolNodes,
    map,
    a.roots ?? [],
    b.roots ?? [],
  );

  const nodes: GraphNode[] = [];
  const ghostNodes: GraphNode[] = [];
  const missingNodes: GraphNode[] = [];
  for (const { node, category } of merged.values()) {
    if (category === "real") nodes.push(node);
    else if (category === "ghost") ghostNodes.push(node);
    else missingNodes.push(node);
  }

  const downstream = new Set<string>([...unlockedA, ...unlockedB]);

  const onlyA: string[] = [];
  const onlyB: string[] = [];
  const shared: string[] = [];
  for (const id of downstream) {
    const entry = merged.get(id);
    if (!entry || entry.node.isRoot) continue;
    const side = map.get(id);
    if (side === "a") onlyA.push(entry.node.code);
    else if (side === "b") onlyB.push(entry.node.code);
    else if (side === "both") shared.push(entry.node.code);
  }
  onlyA.sort();
  onlyB.sort();
  shared.sort();

  return {
    response: {
      nodes,
      boolNodes,
      ghostNodes,
      missingNodes,
      edges,
      truncated: Boolean(a.truncated || b.truncated),
      roots: [...new Set([...(a.roots ?? []), ...(b.roots ?? [])])],
    },
    diff: {
      map,
      summary: { onlyA, onlyB, shared },
    },
  };
}
