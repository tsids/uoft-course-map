export type GraphNodeRole =
  | "root"
  | "prerequisite"
  | "requiredPrerequisite"
  | "postrequisite"
  | "ghost"
  | "missing"
  | "corequisite"
  | "exclusion"
  | "noPrerequisite"
  | "department";

export type GraphNode = {
  id: string;
  code: string;
  name: string;
  campus: string;
  department: string;
  subjectArea: string;
  faculty: string;
  year: string;
  breadth: string;
  distribution: string;
  sessions: string[];
  hasPrerequisites: boolean;
  openToEngineering: boolean;
  isRoot?: boolean;
  isGhost?: boolean;
  isMissing?: boolean;
  progress?: number;
  missing?: string[];
  roles?: GraphNodeRole[];
};

export type BoolGraphNode = {
  id: string;
  operator: "and" | "or";
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: "prerequisite" | "corequisite" | "postrequisite" | "exclusion";
};

export type GraphResponse = {
  nodes: GraphNode[];
  boolNodes?: BoolGraphNode[];
  ghostNodes: GraphNode[];
  missingNodes?: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  roots: string[];
};

export type CourseMatch = {
  code: string;
  name: string;
};

export type ResolveResponse = {
  matches: CourseMatch[];
};

export type FilterOptions = {
  campuses: string[];
  subjectAreas: string[];
  faculties: string[];
  years: string[];
  breadths: string[];
  distributions: string[];
  deliveryModes: string[];
  sessions: string[];
  dataUpdatedAt?: string | null;
};
