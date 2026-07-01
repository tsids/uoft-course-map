import type { SettingsState } from "../types/filters";
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
  settings: SettingsState,
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

  return hasPrerequisite && settings.showPrerequisites;
}

export function isNodeVisible(
  node: GraphNode,
  settings: SettingsState,
  roleMap: Map<string, Set<GraphNodeRole>>,
): boolean {
  const roles = roleMap.get(node.id) ?? new Set<GraphNodeRole>();

  if (roles.has("root") || node.isRoot) {
    return true;
  }

  if (roles.has("postrequisite") || roles.has("ghost") || node.isGhost) {
    return true;
  }

  if (roles.has("noPrerequisite") || roles.has("department")) {
    return true;
  }

  // Corequisites, exclusions, and prerequisites of unlocked ("required") courses
  // are always part of the displayed chain and shown regardless of settings.
  if (
    roles.has("requiredPrerequisite") ||
    roles.has("corequisite") ||
    roles.has("exclusion")
  ) {
    return true;
  }

  // Only the selected courses' own upward prerequisite tree is gated.
  return roles.has("prerequisite") && settings.showPrerequisites;
}
