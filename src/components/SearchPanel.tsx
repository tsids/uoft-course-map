import { Building2, ChevronDown, EyeOff, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchCourseDetail, resolveCourses } from "../api/client";
import type { CourseMatch, FilterOptions } from "../types/graph";
import type { FilterState } from "../types/filters";
import { CAMPUS_LABELS, campusLabel, YEAR_LEVELS } from "../types/filters";
import {
  hasMultipleCourseCodes,
  isValidCourseCodeFormat,
  parseCommaSeparatedCourses,
} from "../utils/courseCode";
import { track } from "../utils/analytics";

type SearchPanelProps = {
  filters: FilterState;
  filterOptions: FilterOptions;
  roots: string[];
  filtersExpanded: boolean;
  onChange: (patch: Partial<FilterState>) => void;
  onToggleFilters: () => void;
  onAddCourse: (code: string) => void;
  onAddCourses: (codes: string[]) => void;
  onRemoveRoot: (code: string) => void;
  onClearRoots: () => void;
  onResolveError: (message: string | null) => void;
};

type ActiveFilter = {
  key: keyof FilterState;
  label: string;
  value: string;
  removeValue?: string;
};

const ACRONYM_STOP_WORDS = new Set(["and", "of", "the", "for", "in"]);

function subjectAreaAcronym(subjectArea: string): string {
  return subjectArea
    .split(/[\s,()-]+/)
    .filter(
      (word) => /^[a-z]/i.test(word) && !ACRONYM_STOP_WORDS.has(word.toLowerCase()),
    )
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

function subjectAreaMatchesQuery(
  subjectArea: string,
  query: string,
  subjectAreaCodes?: Record<string, string[]>,
): boolean {
  if (subjectArea.toLowerCase().includes(query)) return true;
  const codePrefix = query.replace(/\d.*$/, "");
  if (!codePrefix) return false;
  if (subjectAreaAcronym(subjectArea).startsWith(codePrefix)) return true;
  const codes = subjectAreaCodes?.[subjectArea] ?? [];
  return codes.some((code) => code.toLowerCase().startsWith(codePrefix));
}

function displayCodesForSubjectArea(
  subjectArea: string,
  subjectAreaCodes?: Record<string, string[]>,
): string[] {
  const codes = subjectAreaCodes?.[subjectArea] ?? [];
  return codes.filter(
    (code) => !codes.some((other) => other !== code && code.startsWith(other)),
  );
}

function getActiveFilters(filters: FilterState): ActiveFilter[] {
  const entries: ActiveFilter[] = [];
  for (const value of filters.session) {
    entries.push({ key: "session", label: "Session", value, removeValue: value });
  }
  for (const value of filters.campus) {
    entries.push({ key: "campus", label: "Campus", value: campusLabel(value), removeValue: value });
  }
  for (const value of filters.year) {
    entries.push({
      key: "year",
      label: "Course Level",
      value: YEAR_LEVELS.find((level) => level.value === value)?.label ?? value,
      removeValue: value,
    });
  }
  for (const value of filters.breadth) {
    entries.push({ key: "breadth", label: "Breadth", value, removeValue: value });
  }
  for (const value of filters.distribution) {
    entries.push({ key: "distribution", label: "Distribution", value, removeValue: value });
  }
  for (const value of filters.delivery) {
    entries.push({ key: "delivery", label: "Delivery", value, removeValue: value });
  }
  for (const value of filters.faculty) {
    entries.push({ key: "faculty", label: "Faculty", value, removeValue: value });
  }
  for (const value of filters.excludeCourses) {
    entries.push({ key: "excludeCourses", label: "Hidden", value, removeValue: value });
  }
  for (const value of filters.excludeSubjectAreas) {
    entries.push({ key: "excludeSubjectAreas", label: "Hidden", value, removeValue: value });
  }
  if (filters.showAllNoPrereqCourses) {
    entries.push({ key: "showAllNoPrereqCourses", label: "Showing", value: "All no-prereq courses" });
  }
  return entries;
}

function MultiSelectField({
  label,
  values,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  values: string[];
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
    } else {
      onChange([...values, value]);
    }
  };

  const summary =
    values.length === 0
      ? "Any"
      : values.length === 1
        ? (optionLabels?.[values[0]] ?? values[0])
        : `${values.length} selected`;

  return (
    <div ref={containerRef} className="relative flex min-w-[9rem] flex-1 flex-col gap-1 text-xs">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-slate-200 bg-surface px-2 py-1.5 text-left text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-56 w-full min-w-[11rem] overflow-y-auto rounded-md border border-slate-200 bg-surface py-1 shadow-lg dark:border-slate-600 dark:bg-[#1f242d]"
        >
          {options.map((option) => (
            <li key={option} role="option" aria-selected={values.includes(option)}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50">
                <input
                  type="checkbox"
                  checked={values.includes(option)}
                  onChange={() => toggleValue(option)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-[#1f242d]"
                />
                <span className="truncate">{optionLabels?.[option] ?? option}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExcludeSubjectAreaField({
  excluded,
  options,
  subjectAreaCodes,
  onAdd,
}: {
  excluded: string[];
  options: string[];
  subjectAreaCodes?: Record<string, string[]>;
  onAdd: (subjectArea: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 1) return [];
    const selected = new Set(excluded);
    return options.filter(
      (subjectArea) =>
        !selected.has(subjectArea) &&
        subjectAreaMatchesQuery(subjectArea, normalized, subjectAreaCodes),
    );
  }, [query, options, subjectAreaCodes, excluded]);

  const select = (subjectArea: string) => {
    onAdd(subjectArea);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const showSuggestions = open && query.trim().length >= 1 && suggestions.length > 0;

  return (
    <div
      ref={containerRef}
      onBlurCapture={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
      className="flex flex-col gap-1 text-xs"
    >
      <span className="font-medium text-slate-600 dark:text-slate-300">
        Exclude subject areas
      </span>
      <div className="relative min-w-0">
        <EyeOff className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          aria-controls="exclude-subject-area-suggestions"
          placeholder="Hide a subject area from the graph..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            if (query.trim().length >= 1) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (suggestions.length === 0) return;
              setActiveIndex((current) => (current < suggestions.length - 1 ? current + 1 : 0));
              setOpen(true);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (suggestions.length === 0) return;
              setActiveIndex((current) => (current > 0 ? current - 1 : suggestions.length - 1));
              setOpen(true);
              return;
            }
            if (event.key === "Escape") {
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (activeIndex >= 0 && suggestions[activeIndex]) {
                select(suggestions[activeIndex]);
                return;
              }
              if (suggestions.length > 0) {
                select(suggestions[0]);
              }
            }
          }}
          className="w-full rounded-md border border-slate-200 bg-surface py-2 pl-8 pr-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-rose-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
        />

        {showSuggestions && (
          <ul
            id="exclude-subject-area-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-surface py-1 shadow-lg dark:border-slate-600 dark:bg-[#1f242d]"
          >
            {suggestions.map((subjectArea, index) => (
              <li key={subjectArea} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(subjectArea)}
                  className={[
                    "flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm transition",
                    index === activeIndex
                      ? "bg-rose-50 text-slate-900 dark:bg-rose-500/15 dark:text-slate-100"
                      : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50",
                  ].join(" ")}
                >
                  <span className="truncate">{subjectArea}</span>
                  {displayCodesForSubjectArea(subjectArea, subjectAreaCodes).length > 0 && (
                    <span className="max-w-[45%] truncate text-xs text-slate-400 dark:text-slate-500">
                      {displayCodesForSubjectArea(subjectArea, subjectAreaCodes).join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 transition hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-500"
      title={`Clear ${label} filter`}
    >
      <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="truncate">{value}</span>
      <X className="h-3 w-3 shrink-0" />
    </button>
  );
}

export function SearchPanel({
  filters,
  filterOptions,
  roots,
  filtersExpanded,
  onChange,
  onToggleFilters,
  onAddCourse,
  onAddCourses,
  onRemoveRoot,
  onClearRoots,
  onResolveError,
}: SearchPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subjectAreaInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CourseMatch[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [subjectAreaQuery, setSubjectAreaQuery] = useState("");
  const [subjectAreaSuggestionsOpen, setSubjectAreaSuggestionsOpen] = useState(false);
  const [subjectAreaActiveIndex, setSubjectAreaActiveIndex] = useState(-1);
  const activeFilters = getActiveFilters(filters);

  const yearLevelLabels = Object.fromEntries(YEAR_LEVELS.map(({ value, label }) => [value, label]));

  const subjectAreaSuggestions = useMemo(() => {
    const query = subjectAreaQuery.trim().toLowerCase();
    if (query.length < 1) return [];
    const selected = new Set(filters.subjectAreas);
    return filterOptions.subjectAreas.filter(
      (subjectArea) =>
        !selected.has(subjectArea) &&
        subjectAreaMatchesQuery(subjectArea, query, filterOptions.subjectAreaCodes),
    );
  }, [subjectAreaQuery, filterOptions.subjectAreas, filterOptions.subjectAreaCodes, filters.subjectAreas]);

  const collapseUnlessFocused = () => {
    const container = containerRef.current;
    if (container?.contains(document.activeElement)) return;
    setOpen(false);
  };

  useEffect(() => {
    const query = filters.search.trim();
    if (query.length < 2 || hasMultipleCourseCodes(query)) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setSuggestionsLoading(true);

    const timer = window.setTimeout(() => {
      resolveCourses(query, controller.signal)
        .then(({ matches }) => {
          setSuggestions(matches);
          setActiveIndex(matches.length > 0 ? 0 : -1);
          setSuggestionsOpen(true);
          onResolveError(null);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setSuggestions([]);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSuggestionsLoading(false);
          }
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters.search, onResolveError]);

  const selectCourse = (code: string) => {
    onAddCourse(code);
    onChange({ search: "" });
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const selectSubjectArea = (subjectArea: string) => {
    if (filters.subjectAreas.includes(subjectArea)) return;
    onChange({ subjectAreas: [...filters.subjectAreas, subjectArea] });
    setSubjectAreaQuery("");
    setSubjectAreaSuggestionsOpen(false);
    setSubjectAreaActiveIndex(-1);
    subjectAreaInputRef.current?.focus();
  };

  const removeSubjectArea = (subjectArea: string) => {
    onChange({ subjectAreas: filters.subjectAreas.filter((item) => item !== subjectArea) });
  };

  const addSubjectAreasFromList = (raw: string) => {
    const parts = parseCommaSeparatedCourses(raw);
    if (parts.length === 0) return;

    const errors: string[] = [];
    const next = [...filters.subjectAreas];
    const selected = new Set(next.map((area) => area.toLowerCase()));

    for (const part of parts) {
      const query = part.toLowerCase();
      const matches = filterOptions.subjectAreas.filter((area) =>
        subjectAreaMatchesQuery(area, query, filterOptions.subjectAreaCodes),
      );
      const match =
        matches.find((area) => area.toLowerCase() === query) ??
        matches.find((area) =>
          (filterOptions.subjectAreaCodes?.[area] ?? []).some(
            (code) => code.toLowerCase() === query,
          ),
        ) ??
        matches.find((area) => subjectAreaAcronym(area) === query) ??
        (matches.length === 1 ? matches[0] : undefined);

      if (!match) {
        errors.push(
          matches.length > 1
            ? `Ambiguous subject area: ${part}`
            : `Subject area not found: ${part}`,
        );
        continue;
      }
      if (selected.has(match.toLowerCase())) {
        errors.push(`Subject area already added: ${match}`);
        continue;
      }
      selected.add(match.toLowerCase());
      next.push(match);
    }

    const added = next.length > filters.subjectAreas.length;
    if (added) {
      onChange({ subjectAreas: next });
    }

    setSubjectAreaQuery("");
    setSubjectAreaSuggestionsOpen(false);
    setSubjectAreaActiveIndex(-1);
    subjectAreaInputRef.current?.focus();

    if (errors.length > 0) {
      onResolveError(errors.join("; "));
    } else if (added) {
      onResolveError(null);
    }
  };

  const multiSelectKeys = [
    "session",
    "campus",
    "year",
    "breadth",
    "distribution",
    "delivery",
    "faculty",
    "excludeCourses",
    "excludeSubjectAreas",
  ] as const;

  const clearFilter = (key: keyof FilterState, removeValue?: string) => {
    if (key === "showAllNoPrereqCourses") {
      onChange({ showAllNoPrereqCourses: false });
      return;
    }
    if (key === "subjectAreas") {
      if (removeValue) {
        removeSubjectArea(removeValue);
        return;
      }
      onChange({ subjectAreas: [] });
      return;
    }
    if ((multiSelectKeys as readonly string[]).includes(key)) {
      const multiKey = key as (typeof multiSelectKeys)[number];
      if (removeValue) {
        onChange({ [multiKey]: filters[multiKey].filter((item) => item !== removeValue) } as Partial<FilterState>);
        return;
      }
      onChange({ [multiKey]: [] } as Partial<FilterState>);
      return;
    }
    onChange({ [key]: "" } as Partial<FilterState>);
  };

  const clearCourseSearch = () => {
    onChange({ search: "" });
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
  };

  const addCoursesFromList = async (raw: string) => {
    const parts = parseCommaSeparatedCourses(raw);
    if (parts.length === 0) return;

    const errors: string[] = [];
    const toAdd: string[] = [];
    const existing = new Set(roots);

    for (const part of parts) {
      if (!isValidCourseCodeFormat(part)) {
        errors.push(`Invalid course code format: ${part}`);
        continue;
      }

      try {
        const detail = await fetchCourseDetail(part);
        if (existing.has(detail.code)) {
          errors.push(`Course already added: ${detail.code}`);
          continue;
        }
        existing.add(detail.code);
        toAdd.push(detail.code);
      } catch {
        errors.push(`Course not found: ${part}`);
      }
    }

    if (toAdd.length > 0) {
      onAddCourses(toAdd);
    }

    clearCourseSearch();
    inputRef.current?.focus();

    if (errors.length > 0) {
      onResolveError(errors.join("; "));
    } else if (toAdd.length > 0) {
      onResolveError(null);
    }
  };

  const submitSearch = () => {
    const query = filters.search.trim();
    if (!query) return;

    track("search-query", { query });

    if (hasMultipleCourseCodes(query)) {
      void addCoursesFromList(query);
      return;
    }

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectCourse(suggestions[activeIndex].code);
      return;
    }

    if (suggestions.length > 0) {
      selectCourse(suggestions[0].code);
      return;
    }

    if (isValidCourseCodeFormat(query)) {
      void addCoursesFromList(query);
      return;
    }

    onResolveError(`No courses found for "${query}"`);
  };

  const showSuggestions =
    suggestionsOpen &&
    filters.search.trim().length >= 2 &&
    (suggestionsLoading || suggestions.length > 0);

  const showSubjectAreaSuggestions =
    subjectAreaSuggestionsOpen &&
    subjectAreaQuery.trim().length >= 1 &&
    subjectAreaSuggestions.length > 0;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={collapseUnlessFocused}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
          setSuggestionsOpen(false);
          setSubjectAreaSuggestionsOpen(false);
        }
      }}
      className={[
        "pointer-events-auto z-20 rounded-xl border backdrop-blur-sm",
        "transition-[width,background-color,border-color,box-shadow,padding] duration-200 ease-out",
        open
          ? "w-[min(42rem,calc(100vw-2rem))] border-slate-200/80 bg-surface/95 p-3 shadow-lg dark:border-slate-700/80 dark:bg-[#252a33]/95"
          : "w-44 sm:w-56 border-slate-200/20 bg-surface/15 p-1.5 shadow-none dark:border-slate-700/20 dark:bg-[#252a33]/15",
      ].join(" ")}
    >
      <label className="flex flex-col gap-1">
        <span
          className={[
            "text-xs font-medium text-slate-600 transition-opacity duration-200 dark:text-slate-300",
            open ? "opacity-100" : "sr-only",
          ].join(" ")}
        >
          Search courses
        </span>
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search
              className={[
                "pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors",
                open ? "text-slate-400" : "text-slate-400/70",
              ].join(" ")}
            />
            <input
              ref={inputRef}
              type="search"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
              aria-controls="course-suggestions"
              placeholder={open ? "Search by code or name (comma-separated)..." : "Search courses..."}
              value={filters.search}
              onChange={(event) => {
                onChange({ search: event.target.value });
                if (!hasMultipleCourseCodes(event.target.value)) {
                  setSuggestionsOpen(true);
                } else {
                  setSuggestionsOpen(false);
                  setSuggestions([]);
                  setActiveIndex(-1);
                }
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (!hasMultipleCourseCodes(text)) return;
                event.preventDefault();
                void addCoursesFromList(text);
              }}
              onFocus={() => {
                if (filters.search.trim().length >= 2) {
                  setSuggestionsOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (suggestions.length === 0) return;
                  setActiveIndex((current) =>
                    current < suggestions.length - 1 ? current + 1 : 0,
                  );
                  setSuggestionsOpen(true);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (suggestions.length === 0) return;
                  setActiveIndex((current) =>
                    current > 0 ? current - 1 : suggestions.length - 1,
                  );
                  setSuggestionsOpen(true);
                  return;
                }
                if (event.key === "Escape") {
                  setSuggestionsOpen(false);
                  setActiveIndex(-1);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitSearch();
                }
              }}
              className={[
                "w-full rounded-md border py-2 pl-8 pr-2 text-sm outline-none transition-colors duration-200",
                open
                  ? "border-slate-200 bg-surface text-slate-800 placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
                  : "border-transparent bg-transparent text-slate-500 placeholder:text-slate-400/80 focus:border-slate-200/40 dark:text-slate-400 dark:placeholder:text-slate-500/80 dark:focus:border-slate-600/40",
              ].join(" ")}
            />

            {showSuggestions && (
              <ul
                id="course-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-surface py-1 shadow-lg dark:border-slate-600 dark:bg-[#1f242d]"
              >
                {suggestionsLoading && (
                  <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    Searching...
                  </li>
                )}
                {!suggestionsLoading && suggestions.length === 0 && (
                  <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    No courses found
                  </li>
                )}
                {!suggestionsLoading &&
                  suggestions.map((match, index) => (
                    <li key={match.code} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCourse(match.code)}
                        className={[
                          "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition",
                          index === activeIndex
                            ? "bg-blue-50 dark:bg-blue-500/15"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50",
                        ].join(" ")}
                      >
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {match.code}
                        </span>
                        <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                          {match.name}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {open && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                onToggleFilters();
              }}
              aria-label={filtersExpanded ? "Hide filters" : "Show filters"}
              aria-expanded={filtersExpanded}
              title={filtersExpanded ? "Hide filters" : "Show filters"}
              className={[
                "grid aspect-square shrink-0 place-items-center self-stretch rounded-md border transition duration-200",
                filtersExpanded
                  ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-400"
                  : "border-slate-200 bg-surface/80 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200",
              ].join(" ")}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </label>

      <label
        className={[
          "flex cursor-pointer items-center gap-1.5 overflow-hidden transition-all duration-200",
          open
            ? "mt-2 max-h-8 opacity-100"
            : "pointer-events-none mt-0 max-h-0 opacity-0",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={filters.showAllNoPrereqCourses}
          onChange={(event) => onChange({ showAllNoPrereqCourses: event.target.checked })}
          className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-[#1f242d]"
        />
        <span className="truncate text-xs text-slate-600 dark:text-slate-300">
          Show all courses with no prerequisites
        </span>
      </label>

      <label
        className={[
          "flex flex-col gap-1 transition-all duration-200",
          open ? "mt-2 opacity-100" : "mt-1 opacity-90",
        ].join(" ")}
      >
        <span
          className={[
            "text-xs font-medium text-slate-600 transition-opacity duration-200 dark:text-slate-300",
            open ? "opacity-100" : "sr-only",
          ].join(" ")}
        >
          Search subject areas
        </span>
        <div className="relative min-w-0">
          <Building2
            className={[
              "pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transition-colors",
              open ? "text-slate-400" : "text-slate-400/70",
            ].join(" ")}
          />
          <input
            ref={subjectAreaInputRef}
            type="search"
            role="combobox"
            aria-expanded={showSubjectAreaSuggestions}
            aria-autocomplete="list"
            aria-controls="subject-area-suggestions"
            placeholder={
              open
                ? filters.subjectAreas.length > 0
                  ? "Add another subject area..."
                  : "Search by subject area (comma-separated)..."
                : filters.subjectAreas.length > 0
                  ? `${filters.subjectAreas.length} area${filters.subjectAreas.length === 1 ? "" : "s"}`
                  : "Subject area..."
            }
            value={subjectAreaQuery}
            onChange={(event) => {
              setSubjectAreaQuery(event.target.value);
              if (!event.target.value.includes(",")) {
                setSubjectAreaSuggestionsOpen(true);
                setSubjectAreaActiveIndex(0);
              } else {
                setSubjectAreaSuggestionsOpen(false);
                setSubjectAreaActiveIndex(-1);
              }
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (!text.includes(",")) return;
              event.preventDefault();
              addSubjectAreasFromList(text);
            }}
            onFocus={() => {
              if (subjectAreaQuery.trim().length >= 1) {
                setSubjectAreaSuggestionsOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (subjectAreaSuggestions.length === 0) return;
                setSubjectAreaActiveIndex((current) =>
                  current < subjectAreaSuggestions.length - 1 ? current + 1 : 0,
                );
                setSubjectAreaSuggestionsOpen(true);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (subjectAreaSuggestions.length === 0) return;
                setSubjectAreaActiveIndex((current) =>
                  current > 0 ? current - 1 : subjectAreaSuggestions.length - 1,
                );
                setSubjectAreaSuggestionsOpen(true);
                return;
              }
              if (event.key === "Escape") {
                setSubjectAreaSuggestionsOpen(false);
                setSubjectAreaActiveIndex(-1);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (subjectAreaQuery.includes(",")) {
                  addSubjectAreasFromList(subjectAreaQuery);
                  return;
                }
                if (subjectAreaActiveIndex >= 0 && subjectAreaSuggestions[subjectAreaActiveIndex]) {
                  selectSubjectArea(subjectAreaSuggestions[subjectAreaActiveIndex]);
                  return;
                }
                if (subjectAreaSuggestions.length > 0) {
                  selectSubjectArea(subjectAreaSuggestions[0]);
                }
              }
            }}
            className={[
              "w-full rounded-md border py-2 pl-8 pr-2 text-sm outline-none transition-colors duration-200",
              open
                ? "border-slate-200 bg-surface text-slate-800 placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
                : "border-transparent bg-transparent text-slate-500 placeholder:text-slate-400/80 focus:border-slate-200/40 dark:text-slate-400 dark:placeholder:text-slate-500/80 dark:focus:border-slate-600/40",
            ].join(" ")}
          />

          {showSubjectAreaSuggestions && (
            <ul
              id="subject-area-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-surface py-1 shadow-lg dark:border-slate-600 dark:bg-[#1f242d]"
            >
              {subjectAreaSuggestions.map((subjectArea, index) => (
                <li key={subjectArea} role="option" aria-selected={index === subjectAreaActiveIndex}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setSubjectAreaActiveIndex(index)}
                    onClick={() => selectSubjectArea(subjectArea)}
                    className={[
                      "flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm transition",
                      index === subjectAreaActiveIndex
                        ? "bg-blue-50 text-slate-900 dark:bg-blue-500/15 dark:text-slate-100"
                        : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/50",
                    ].join(" ")}
                  >
                    <span className="truncate">{subjectArea}</span>
                    {displayCodesForSubjectArea(subjectArea, filterOptions.subjectAreaCodes)
                      .length > 0 && (
                      <span className="max-w-[45%] truncate text-xs text-slate-400 dark:text-slate-500">
                        {displayCodesForSubjectArea(
                          subjectArea,
                          filterOptions.subjectAreaCodes,
                        ).join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </label>

      {filters.subjectAreas.length > 0 && (
        <div
          className={[
            "flex flex-wrap items-center gap-1.5 overflow-hidden transition-all duration-200",
            open ? "mt-2 max-h-24 opacity-100" : "mt-1 max-h-8 opacity-90",
          ].join(" ")}
        >
          {filters.subjectAreas.map((subjectArea) => (
            <button
              key={subjectArea}
              type="button"
              onClick={() => removeSubjectArea(subjectArea)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 transition hover:border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
              title={`Remove ${subjectArea} filter`}
            >
              <span className="truncate">{subjectArea}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {roots.length > 0 && (
        <div
          className={[
            "flex flex-wrap items-center gap-1.5 overflow-hidden transition-all duration-200",
            open ? "mt-2 max-h-24 opacity-100" : "mt-1 max-h-8 opacity-90",
          ].join(" ")}
        >
          {roots.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onRemoveRoot(code)}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition hover:border-blue-300 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
            >
              {code}
              <X className="h-3 w-3" />
            </button>
          ))}
          {open && roots.length > 1 && (
            <button
              type="button"
              onClick={onClearRoots}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {activeFilters.length > 0 && (
        <div
          className={[
            "flex flex-wrap items-center gap-1.5 overflow-hidden transition-all duration-200",
            open ? "mt-2 max-h-24 opacity-100" : "mt-1 max-h-16 opacity-90",
          ].join(" ")}
        >
          {activeFilters.map((filter) => (
            <FilterChip
              key={`${filter.key}:${filter.value}`}
              label={filter.label}
              value={filter.value}
              onClear={() => clearFilter(filter.key, filter.removeValue)}
            />
          ))}
        </div>
      )}

      <div
        className={[
          "flex flex-col gap-3 transition-all duration-200 ease-out",
          open && filtersExpanded
            ? "mt-3 max-h-[70vh] overflow-visible opacity-100"
            : "pointer-events-none max-h-0 overflow-hidden opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-2">
          <MultiSelectField
            label="Session"
            values={filters.session}
            options={filterOptions.sessions}
            onChange={(session) => onChange({ session })}
          />
          <MultiSelectField
            label="Campus"
            values={filters.campus}
            options={filterOptions.campuses}
            optionLabels={CAMPUS_LABELS}
            onChange={(campus) => onChange({ campus })}
          />
          <MultiSelectField
            label="Course Level"
            values={filters.year}
            options={filterOptions.years}
            optionLabels={yearLevelLabels}
            onChange={(year) => onChange({ year })}
          />
          <MultiSelectField
            label="Breadth REQ"
            values={filters.breadth}
            options={filterOptions.breadths}
            onChange={(breadth) => onChange({ breadth })}
          />
          <MultiSelectField
            label="Distribution REQ"
            values={filters.distribution}
            options={filterOptions.distributions}
            onChange={(distribution) => onChange({ distribution })}
          />
          <MultiSelectField
            label="Delivery"
            values={filters.delivery}
            options={filterOptions.deliveryModes}
            onChange={(delivery) => onChange({ delivery })}
          />
          <MultiSelectField
            label="Faculty"
            values={filters.faculty}
            options={filterOptions.faculties}
            onChange={(faculty) => onChange({ faculty })}
          />
        </div>

        <ExcludeSubjectAreaField
          excluded={filters.excludeSubjectAreas}
          options={filterOptions.subjectAreas}
          subjectAreaCodes={filterOptions.subjectAreaCodes}
          onAdd={(subjectArea) =>
            onChange({ excludeSubjectAreas: [...filters.excludeSubjectAreas, subjectArea] })
          }
        />
      </div>
    </div>
  );
}
