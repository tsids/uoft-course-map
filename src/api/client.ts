import type { CourseDetail } from "../types/course";
import type { BoolGraphNode, FilterOptions, GraphNode, GraphNodeRole, GraphResponse, ResolveResponse } from "../types/graph";
import type { FilterState } from "../types/filters";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function pick<T>(value: T | undefined, snake: T | undefined, fallback: T): T {
  if (value !== undefined) return value;
  if (snake !== undefined) return snake;
  return fallback;
}

function normalizeNode(raw: GraphNode & Record<string, unknown>): GraphNode {
  return {
    id: String(raw.id),
    code: String(raw.code),
    name: String(raw.name),
    campus: String(raw.campus ?? ""),
    subjectArea: String(raw.subjectArea ?? raw.subject_area ?? ""),
    department: String(raw.subjectArea ?? raw.subject_area ?? ""),
    faculty: String(raw.faculty ?? ""),
    year: String(raw.year ?? ""),
    breadth: String(raw.breadth ?? ""),
    distribution: String(raw.distribution ?? ""),
    sessions: Array.isArray(raw.sessions) ? raw.sessions.map(String) : [],
    hasPrerequisites: pick(raw.hasPrerequisites, raw.has_prerequisites as boolean | undefined, false),
    openToEngineering: pick(raw.openToEngineering, raw.open_to_engineering as boolean | undefined, true),
    isRoot: pick(raw.isRoot, raw.is_root as boolean | undefined, false),
    isGhost: pick(raw.isGhost, raw.is_ghost as boolean | undefined, false),
    isMissing: pick(raw.isMissing, raw.is_missing as boolean | undefined, false),
    progress: typeof raw.progress === "number" ? raw.progress : undefined,
    missing: Array.isArray(raw.missing) ? raw.missing.map(String) : [],
    missingConditions: Array.isArray(raw.missingConditions ?? raw.missing_conditions)
      ? ((raw.missingConditions ?? raw.missing_conditions) as unknown[]).map(String)
      : [],
    roles: Array.isArray(raw.roles) ? (raw.roles as GraphNodeRole[]) : [],
  };
}

function normalizeBoolNode(raw: BoolGraphNode & Record<string, unknown>): BoolGraphNode {
  const operator = raw.operator === "or" ? "or" : "and";
  return {
    id: String(raw.id),
    operator,
  };
}

function normalizeGraphResponse(
  data: GraphResponse & {
    ghost_nodes?: GraphResponse["ghostNodes"];
    missing_nodes?: GraphResponse["missingNodes"];
    bool_nodes?: GraphResponse["boolNodes"];
  },
): GraphResponse {
  const nodes = (data.nodes ?? []).map((node) => normalizeNode(node as GraphNode & Record<string, unknown>));
  const ghostNodes = (data.ghostNodes ?? data.ghost_nodes ?? []).map((node) =>
    normalizeNode(node as GraphNode & Record<string, unknown>),
  );
  const missingNodes = (data.missingNodes ?? data.missing_nodes ?? []).map((node) =>
    normalizeNode(node as GraphNode & Record<string, unknown>),
  );
  const boolNodes = (data.boolNodes ?? data.bool_nodes ?? []).map((node) =>
    normalizeBoolNode(node as BoolGraphNode & Record<string, unknown>),
  );

  return {
    nodes,
    boolNodes,
    ghostNodes,
    missingNodes,
    edges: data.edges ?? [],
    truncated: data.truncated ?? false,
    roots: data.roots ?? [],
  };
}

function buildQuery(
  roots: string[],
  filters: FilterState,
  engineeringStudent: boolean,
  recursivePostrequisites: boolean,
  maxCourses: number,
  fce: number | null,
  gpa: number | null,
  compare: boolean,
) {
  const params = new URLSearchParams();

  if (roots.length > 0) params.set("roots", roots.join(","));
  if (filters.campus.length > 0) params.set("campus", filters.campus.join(","));
  if (filters.subjectAreas.length > 0) params.set("subject_area", filters.subjectAreas.join(","));
  if (filters.faculty.length > 0) params.set("faculty", filters.faculty.join(","));
  if (filters.year.length > 0) params.set("year", filters.year.join(","));
  if (filters.breadth.length > 0) params.set("breadth", filters.breadth.join(","));
  if (filters.distribution.length > 0) params.set("distribution", filters.distribution.join(","));
  if (filters.delivery.length > 0) params.set("delivery", filters.delivery.join(","));
  if (filters.session.length > 0) params.set("session", filters.session.join(","));
  if (filters.excludeCourses.length > 0) params.set("exclude_courses", filters.excludeCourses.join(","));
  if (filters.excludeSubjectAreas.length > 0)
    params.set("exclude_subject_area", filters.excludeSubjectAreas.join(","));
  if (engineeringStudent) params.set("engineering_student", "true");
  if (filters.showAllNoPrereqCourses) params.set("no_prerequisites", "true");
  if (recursivePostrequisites) params.set("recursive", "true");
  if (maxCourses > 0) params.set("max_nodes", String(maxCourses));
  if (fce !== null) params.set("fce", String(fce));
  if (gpa !== null) params.set("gpa", String(gpa));
  if (compare) params.set("compare", "true");

  return params;
}

export async function fetchGraph(
  roots: string[],
  filters: FilterState,
  engineeringStudent: boolean,
  recursivePostrequisites: boolean,
  maxCourses: number,
  fce: number | null,
  gpa: number | null,
  compare: boolean = false,
  signal?: AbortSignal,
): Promise<GraphResponse> {
  const params = buildQuery(roots, filters, engineeringStudent, recursivePostrequisites, maxCourses, fce, gpa, compare);
  const response = await fetch(`${API_BASE}/api/graph?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load graph (${response.status})`);
  }

  const data = (await response.json()) as GraphResponse & { ghost_nodes?: GraphResponse["ghostNodes"] };

  return normalizeGraphResponse(data);
}

export async function resolveCourses(
  search: string,
  signal?: AbortSignal,
): Promise<ResolveResponse> {
  const params = new URLSearchParams({ search });
  const response = await fetch(`${API_BASE}/api/courses/resolve?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve course (${response.status})`);
  }

  return response.json() as Promise<ResolveResponse>;
}

export async function fetchFilterOptions(signal?: AbortSignal): Promise<FilterOptions> {
  const response = await fetch(`${API_BASE}/api/filters/options`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load filter options (${response.status})`);
  }

  return response.json() as Promise<FilterOptions>;
}

function normalizeCourseDetail(raw: CourseDetail & Record<string, unknown>): CourseDetail {
  return {
    code: String(raw.code),
    name: String(raw.name),
    campus: String(raw.campus ?? ""),
    description: String(raw.description ?? ""),
    note: String(raw.note ?? ""),
    prerequisitesText: String(pick(raw.prerequisitesText, raw.prerequisites_text as string | undefined, "")),
    corequisitesText: String(pick(raw.corequisitesText, raw.corequisites_text as string | undefined, "")),
    exclusionsText: String(pick(raw.exclusionsText, raw.exclusions_text as string | undefined, "")),
    recommendedPreparation: String(
      pick(raw.recommendedPreparation, raw.recommended_preparation as string | undefined, ""),
    ),
    breadth: Array.isArray(raw.breadth) ? raw.breadth.map(String) : [],
    distribution: Array.isArray(raw.distribution) ? raw.distribution.map(String) : [],
  };
}

export type FeedbackPayload = {
  topic: "bug" | "suggestion";
  summary: string;
  details: string;
  email: string;
  website: string;
};

export type FeedbackResponse = {
  ok: boolean;
  issueNumber?: number;
  issueUrl?: string;
};

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
  const response = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit feedback (${response.status})`);
  }

  return response.json() as Promise<FeedbackResponse>;
}

export async function fetchCourseDetail(code: string, signal?: AbortSignal): Promise<CourseDetail> {
  const response = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(code)}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load course (${response.status})`);
  }

  const data = (await response.json()) as CourseDetail & Record<string, unknown>;
  return normalizeCourseDetail(data);
}
