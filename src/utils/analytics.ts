import type { FilterState, SettingsState } from "../types/filters";

type EventData = Record<string, string | number | boolean>;

type UmamiTracker = {
  track: (eventName: string, eventData?: EventData) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

export function track(eventName: string, eventData?: EventData): void {
  if (typeof window === "undefined") return;
  window.umami?.track(eventName, eventData);
}

const FILTER_EVENT_TYPES: Partial<Record<keyof FilterState, string>> = {
  session: "session",
  campus: "campus",
  year: "level",
  breadth: "breadth",
  distribution: "distribution",
  delivery: "delivery",
  faculty: "faculty",
};

export function trackFilterChange(prev: FilterState, patch: Partial<FilterState>): void {
  for (const key of Object.keys(patch) as (keyof FilterState)[]) {
    if (key === "search") continue;

    if (key === "showAllNoPrereqCourses") {
      if (patch.showAllNoPrereqCourses !== prev.showAllNoPrereqCourses) {
        track("setting", {
          name: "show-all-no-prereq",
          value: patch.showAllNoPrereqCourses === true,
        });
      }
      continue;
    }

    const before = prev[key] as string[];
    const after = patch[key] as string[];
    const added = after.filter((value) => !before.includes(value));

    if (key === "subjectAreas") {
      for (const value of added) track("subject-area", { area: value });
      continue;
    }
    if (key === "excludeSubjectAreas") {
      for (const value of added) track("exclude", { type: "subject-area", value });
      continue;
    }
    if (key === "excludeCourses") {
      for (const value of added) track("exclude", { type: "course", value });
      continue;
    }

    const type = FILTER_EVENT_TYPES[key];
    if (!type) continue;
    for (const value of added) track("filter", { type, value });
  }
}

export function trackSettingsChange(prev: SettingsState, patch: Partial<SettingsState>): void {
  for (const key of Object.keys(patch) as (keyof SettingsState)[]) {
    if (patch[key] === prev[key]) continue;
    track("setting", { name: key, value: patch[key] as string | number | boolean });
  }
}
