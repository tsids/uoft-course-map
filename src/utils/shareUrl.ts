import {
  BREADTHS,
  CAMPUSES,
  DELIVERY_MODES,
  DISTRIBUTIONS,
  FACULTIES,
  SESSIONS,
  YEARS,
  defaultFilters,
  type FilterState,
} from "../types/filters";
const MAX_LIST_ITEMS = 100;
const MAX_ITEM_LENGTH = 100;

const SHAREABLE_COURSE_CODE = /^[A-Za-z]{2,4}\d{2,4}[HY]\d?$/i;

export type SharedState = {
  roots: string[];
  filters: FilterState;
};

type ListParam = {
  key: keyof Pick<
    FilterState,
    | "campus"
    | "subjectAreas"
    | "faculty"
    | "year"
    | "breadth"
    | "distribution"
    | "delivery"
    | "session"
    | "excludeCourses"
    | "excludeSubjectAreas"
  >;
  param: string;
  allowed?: readonly string[];
  courseCodes?: boolean;
};

const LIST_PARAMS: ListParam[] = [
  { key: "campus", param: "campus", allowed: CAMPUSES },
  { key: "subjectAreas", param: "subject_area" },
  { key: "faculty", param: "faculty", allowed: FACULTIES },
  { key: "year", param: "year", allowed: YEARS },
  { key: "breadth", param: "breadth", allowed: BREADTHS },
  { key: "distribution", param: "distribution", allowed: DISTRIBUTIONS },
  { key: "delivery", param: "delivery", allowed: DELIVERY_MODES },
  { key: "session", param: "session", allowed: SESSIONS },
  { key: "excludeCourses", param: "exclude_courses", courseCodes: true },
  { key: "excludeSubjectAreas", param: "exclude_subject_area" },
];

function sanitizeText(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out.trim();
}

function parseList(
  raw: string | null,
  options: { allowed?: readonly string[]; courseCodes?: boolean } = {},
): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const part of raw.split(",")) {
    const cleaned = sanitizeText(part);
    if (!cleaned || cleaned.length > MAX_ITEM_LENGTH) continue;
    if (options.allowed && !options.allowed.includes(cleaned)) continue;
    if (options.courseCodes && !SHAREABLE_COURSE_CODE.test(cleaned)) continue;
    const value = options.courseCodes ? cleaned.toUpperCase() : cleaned;
    if (seen.has(value)) continue;
    seen.add(value);
    values.push(value);
    if (values.length >= MAX_LIST_ITEMS) break;
  }
  return values;
}

export function buildShareUrl(roots: string[], filters: FilterState): string {
  const params = new URLSearchParams();
  if (roots.length > 0) params.set("roots", roots.join(","));
  for (const { key, param } of LIST_PARAMS) {
    const values = filters[key];
    if (values.length > 0) params.set(param, values.join(","));
  }
  if (filters.showAllNoPrereqCourses) params.set("no_prerequisites", "true");
  const query = params.toString();
  return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
}

export function parseSharedState(search: string): SharedState | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const hasShareParams =
    params.has("roots") ||
    params.has("no_prerequisites") ||
    LIST_PARAMS.some(({ param }) => params.has(param));
  if (!hasShareParams) return null;

  const roots = parseList(params.get("roots"), { courseCodes: true });
  const filters: FilterState = { ...defaultFilters };
  for (const { key, param, allowed, courseCodes } of LIST_PARAMS) {
    filters[key] = parseList(params.get(param), { allowed, courseCodes });
  }
  filters.showAllNoPrereqCourses = params.get("no_prerequisites") === "true";

  if (
    roots.length === 0 &&
    !filters.showAllNoPrereqCourses &&
    LIST_PARAMS.every(({ key }) => filters[key].length === 0)
  ) {
    return null;
  }

  return { roots, filters };
}
