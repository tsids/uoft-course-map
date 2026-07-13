import type { GraphEdge, GraphNode, GraphNodeRole } from "../types/graph";

export function buildNodeRoleMap(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Map<string, Set<GraphNodeRole>> {
  const map = new Map<string, Set<GraphNodeRole>>();

  const addRole = (id: string, role: GraphNodeRole) => {
    const roles = map.get(id) ?? new Set<GraphNodeRole>();
    roles.add(role);
    map.set(id, roles);
  };

  for (const node of nodes) {
    if (node.isRoot) addRole(node.id, "root");
    if (node.isGhost) addRole(node.id, "ghost");
    for (const role of node.roles ?? []) {
      addRole(node.id, role);
    }
  }

  for (const edge of edges) {
    switch (edge.kind) {
      case "prerequisite":
        addRole(edge.from, "prerequisite");
        break;
      case "postrequisite":
        addRole(edge.to, "postrequisite");
        break;
      case "corequisite":
        addRole(edge.from, "corequisite");
        addRole(edge.to, "corequisite");
        break;
      case "exclusion":
        addRole(edge.from, "exclusion");
        addRole(edge.to, "exclusion");
        break;
    }
  }

  return map;
}

export function isBoolNodeVisible(
  boolNodeId: string,
  edges: GraphEdge[],
): boolean {
  const incident = edges.filter((edge) => edge.from === boolNodeId || edge.to === boolNodeId);
  if (incident.length === 0) {
    return false;
  }

  const hasPostrequisite = incident.some((edge) => edge.kind === "postrequisite");
  const hasPrerequisite = incident.some((edge) => edge.kind === "prerequisite");

  if (hasPostrequisite) {
    return true;
  }

  return hasPrerequisite;
}

export function isNodeVisible(
  node: GraphNode,
  roleMap: Map<string, Set<GraphNodeRole>>,
  campusFilter?: ReadonlySet<string>,
): boolean {
  const roles = roleMap.get(node.id) ?? new Set<GraphNodeRole>();

  if (roles.has("root") || node.isRoot) {
    return true;
  }

  if (roles.has("postrequisite") || roles.has("ghost") || node.isGhost) {
    return true;
  }

  // "Needed but missing" prerequisites are shown as faded context nodes.
  if (roles.has("missing") || node.isMissing) {
    return true;
  }

  if (roles.has("noPrerequisite") || roles.has("department")) {
    return true;
  }

  if (roles.has("corequisite") || roles.has("exclusion")) {
    if (!campusFilter || campusFilter.size === 0 || campusFilter.has(node.campus)) {
      return true;
    }
  }

  return roles.has("prerequisite");
}

export function buildPrereqCollapseKeepSet(
  nodes: GraphNode[],
  edges: GraphEdge[],
  roleMap: Map<string, Set<GraphNodeRole>>,
): Set<string> {
  const keep = new Set<string>();

  for (const node of nodes) {
    const roles = roleMap.get(node.id);
    if (
      node.isRoot ||
      roles?.has("root") ||
      roles?.has("noPrerequisite") ||
      roles?.has("department")
    ) {
      keep.add(node.id);
    }
  }

  for (const edge of edges) {
    if (edge.kind === "postrequisite") {
      keep.add(edge.from);
      keep.add(edge.to);
    }
  }

  const anchored = new Set(keep);
  for (const edge of edges) {
    if (edge.kind === "corequisite" || edge.kind === "exclusion") {
      if (anchored.has(edge.from)) keep.add(edge.to);
      if (anchored.has(edge.to)) keep.add(edge.from);
    }
  }

  return keep;
}
