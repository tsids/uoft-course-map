export type FilterState = {
  search: string;
  campus: string[];
  subjectAreas: string[];
  faculty: string[];
  year: string[];
  breadth: string[];
  distribution: string[];
  session: string[];
  showAllNoPrereqCourses: boolean;
};

export type SettingsState = {
  showNoPrerequisites: boolean;
  engineeringStudent: boolean;
  showPrerequisites: boolean;
  highlightPath: boolean;
};

export const defaultFilters: FilterState = {
  search: "",
  campus: [],
  subjectAreas: [],
  faculty: [],
  year: [],
  breadth: [],
  distribution: [],
  session: [],
  showAllNoPrereqCourses: false,
};

export const defaultSettings: SettingsState = {
  showNoPrerequisites: false,
  engineeringStudent: false,
  showPrerequisites: false,
  highlightPath: true,
};

export const FACULTIES = [
  "Faculty of Arts and Science",
  "Faculty of Applied Science & Engineering",
  "John H. Daniels Faculty of Architecture, Landscape, and Design",
];

export const YEARS = ["1", "2", "3", "4", "5+"] as const;

export const YEAR_LEVELS: { value: string; label: string }[] = [
  { value: "1", label: "A / 1" },
  { value: "2", label: "B / 2" },
  { value: "3", label: "C / 3" },
  { value: "4", label: "D / 4" },
  { value: "5+", label: "5+" },
];

export const BREADTHS = [
  "Arts, Literature and Language",
  "Creative and Cultural Representations (1)",
  "History, Philosophy and Cultural Studies",
  "Living Things and Their Environment (4)",
  "Natural Sciences",
  "Quantitative Reasoning",
  "Social and Behavioural Sciences",
  "Society and its Institutions (3)",
  "The Physical and Mathematical Universes (5)",
  "Thought, Belief and Behaviour (2)",
] as const;

export const DISTRIBUTIONS = ["Humanities", "Science", "Social Science"] as const;

export function isValidBreadthFilter(value: string): boolean {
  return (BREADTHS as readonly string[]).includes(value);
}

export function isValidDistributionFilter(value: string): boolean {
  return (DISTRIBUTIONS as readonly string[]).includes(value);
}

export const SESSIONS = [
  "Fall",
  "Winter",
  "Summer: F",
  "Summer: S",
  "Summer",
];

export const CAMPUSES = [
  "St. George",
  "Scarborough",
  "Mississauga",
];

export const STORAGE_KEYS = {
  filters: "courseMap:filters",
  settings: "courseMap:settings",
  roots: "courseMap:roots",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value;
}

export function parseFilterState(stored: unknown): FilterState | null {
  if (!isRecord(stored)) return null;

  const filters = { ...defaultFilters };

  const storedSubjectAreas = readStringArray(stored.subjectAreas);
  if (storedSubjectAreas) {
    filters.subjectAreas = storedSubjectAreas.filter((area) => area.length > 0);
  } else {
    const legacyDepartments = readStringArray(stored.departments);
    if (legacyDepartments) {
      filters.subjectAreas = legacyDepartments.filter((area) => area.length > 0);
    } else {
      const legacyDepartment = readString(stored.department);
      if (legacyDepartment) {
        filters.subjectAreas = [legacyDepartment];
      }
    }
  }

  const storedShowAllNoPrereqCourses = readBoolean(stored.showAllNoPrereqCourses);
  if (storedShowAllNoPrereqCourses !== null) {
    filters.showAllNoPrereqCourses = storedShowAllNoPrereqCourses;
  }

  const multiValueKeys: readonly ("campus" | "faculty" | "year" | "breadth" | "distribution" | "session")[] = [
    "campus",
    "faculty",
    "year",
    "breadth",
    "distribution",
    "session",
  ];

  for (const key of multiValueKeys) {
    const validate =
      key === "breadth" ? isValidBreadthFilter : key === "distribution" ? isValidDistributionFilter : null;

    const arrayValue = readStringArray(stored[key]);
    if (arrayValue) {
      const values = arrayValue.filter((value) => value.length > 0 && (!validate || validate(value)));
      filters[key] = values;
      continue;
    }

    // Legacy single-value filters stored as a plain string.
    const legacyValue = readString(stored[key]);
    if (!legacyValue) continue;
    if (validate && !validate(legacyValue)) continue;
    filters[key] = [legacyValue];
  }

  return filters;
}

export function parseSettingsState(stored: unknown): SettingsState | null {
  if (!isRecord(stored)) return null;

  const settings = { ...defaultSettings };
  for (const key of Object.keys(defaultSettings) as (keyof SettingsState)[]) {
    const value = readBoolean(stored[key]);
    if (value !== null) {
      settings[key] = value;
    }
  }

  return settings;
}

export function parseRoots(stored: unknown): string[] | null {
  if (!Array.isArray(stored)) return null;
  if (!stored.every((item) => typeof item === "string")) return null;
  return stored;
}
