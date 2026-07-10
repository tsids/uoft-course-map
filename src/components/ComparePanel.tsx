import { ArrowLeftRight, ChevronDown, ChevronRight, GitCompareArrows, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchCourseDetail, resolveCourses } from "../api/client";
import type { CourseMatch } from "../types/graph";
import type { DiffSummary } from "../utils/graphDiff";
import {
  hasMultipleCourseCodes,
  isValidCourseCodeFormat,
  parseCommaSeparatedCourses,
} from "../utils/courseCode";

type ComparePanelProps = {
  active: boolean;
  onToggle: () => void;
  rootsA: string[];
  onRemoveA: (code: string) => void;
  rootsB: string[];
  onAddB: (codes: string[]) => void;
  onRemoveB: (code: string) => void;
  onClearB: () => void;
  onSwap: () => void;
  summary: DiffSummary | null;
  onOpenCourseInfo: (code: string) => void;
  onResolveError: (message: string | null) => void;
};

function SummarySection({
  label,
  count,
  tone,
  codes,
  onOpenCourseInfo,
}: {
  label: string;
  count: number;
  tone: "a" | "b" | "both";
  codes: string[];
  onOpenCourseInfo: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const badgeClass =
    tone === "a"
      ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
      : tone === "b"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300";

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={count === 0}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-left text-xs text-slate-600 disabled:cursor-default disabled:opacity-60 dark:text-slate-300"
      >
        {open && count > 0 ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        )}
        <span className="truncate">{label}</span>
        <span
          className={["ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", badgeClass].join(" ")}
        >
          {count}
        </span>
      </button>

      {open && count > 0 && (
        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto pl-4">
          {codes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onOpenCourseInfo(code)}
              title={`View details for ${code}`}
              className="rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              {code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ComparePanel({
  active,
  onToggle,
  rootsA,
  onRemoveA,
  rootsB,
  onAddB,
  onRemoveB,
  onClearB,
  onSwap,
  summary,
  onOpenCourseInfo,
  onResolveError,
}: ComparePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CourseMatch[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!active || !expanded) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-modal-overlay]")) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [active, expanded]);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (trimmed.length < 2 || hasMultipleCourseCodes(trimmed)) {
        setSuggestions([]);
        setActiveIndex(-1);
        return;
      }
      resolveCourses(trimmed, controller.signal)
        .then(({ matches }) => {
          setSuggestions(matches);
          setActiveIndex(matches.length > 0 ? 0 : -1);
          setSuggestionsOpen(true);
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setSuggestions([]);
          setActiveIndex(-1);
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const clearInput = () => {
    setQuery("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
  };

  const selectCourse = (code: string) => {
    if (!rootsB.includes(code)) {
      onAddB([code]);
    }
    clearInput();
    inputRef.current?.focus();
  };

  const addCoursesFromList = async (raw: string) => {
    const parts = parseCommaSeparatedCourses(raw);
    if (parts.length === 0) return;

    const errors: string[] = [];
    const toAdd: string[] = [];
    const existing = new Set(rootsB);

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
      onAddB(toAdd);
    }

    clearInput();
    inputRef.current?.focus();

    if (errors.length > 0) {
      onResolveError(errors.join("; "));
    } else if (toAdd.length > 0) {
      onResolveError(null);
    }
  };

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (hasMultipleCourseCodes(trimmed)) {
      void addCoursesFromList(trimmed);
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

    if (isValidCourseCodeFormat(trimmed)) {
      void addCoursesFromList(trimmed);
      return;
    }

    onResolveError(`No courses found for "${trimmed}"`);
  };

  const showSuggestions = suggestionsOpen && query.trim().length >= 2 && suggestions.length > 0;
  const comparing = rootsA.length > 0 && rootsB.length > 0;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        if (active) setExpanded(true);
      }}
      className="pointer-events-auto flex flex-col items-start gap-2"
    >
      <button
        type="button"
        onClick={() => {
          if (!active) {
            onToggle();
            setExpanded(true);
            return;
          }
          if (!expanded) {
            setExpanded(true);
            return;
          }
          onToggle();
        }}
        aria-expanded={active && expanded}
        className={[
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition",
          active
            ? "border-blue-400 bg-blue-50/95 text-blue-700 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-300"
            : "border-slate-200/80 bg-surface/95 text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700/80 dark:bg-[#252a33]/95 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400",
        ].join(" ")}
      >
        <GitCompareArrows className="h-4 w-4" />
        Compare
      </button>

      {active && expanded && (
        <div className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-surface/95 p-3 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-[#252a33]/95">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Compare postrequisites
            </h2>
            <button
              type="button"
              onClick={onSwap}
              disabled={rootsA.length === 0 && rootsB.length === 0}
              aria-label="Swap groups"
              title="Swap groups"
              className="grid h-6 w-6 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-default disabled:opacity-40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                A
              </span>
              Group A — current selection
            </span>
            {rootsA.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {rootsA.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onRemoveA(code)}
                    className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 transition hover:border-orange-300 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"
                  >
                    {code}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Add courses with the search box above.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                B
              </span>
              Group B
            </span>

            <div className="relative">
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={showSuggestions}
                aria-autocomplete="list"
                aria-controls="compare-suggestions"
                placeholder="Add courses to compare against..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
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
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) {
                    setSuggestionsOpen(false);
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
                    submit();
                  }
                }}
                className="w-full rounded-md border border-slate-200 bg-surface px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
              />

              {showSuggestions && (
                <ul
                  id="compare-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-surface py-1 shadow-lg dark:border-slate-600 dark:bg-[#1f242d]"
                >
                  {suggestions.map((match, index) => (
                    <li key={match.code} role="option" aria-selected={index === activeIndex}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCourse(match.code)}
                        className={[
                          "flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition",
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

            {rootsB.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {rootsB.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onRemoveB(code)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 transition hover:border-rose-300 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {code}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {rootsB.length > 1 && (
                  <button
                    type="button"
                    onClick={onClearB}
                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          {comparing && summary && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-200/70 pt-2 dark:border-slate-700/70">
              <SummarySection
                label="Only group A unlocks"
                count={summary.onlyA.length}
                tone="a"
                codes={summary.onlyA}
                onOpenCourseInfo={onOpenCourseInfo}
              />
              <SummarySection
                label="Only group B unlocks"
                count={summary.onlyB.length}
                tone="b"
                codes={summary.onlyB}
                onOpenCourseInfo={onOpenCourseInfo}
              />
              <SummarySection
                label="Both unlock"
                count={summary.shared.length}
                tone="both"
                codes={summary.shared}
                onOpenCourseInfo={onOpenCourseInfo}
              />
            </div>
          )}

          {!comparing && (
            <p className="mt-3 border-t border-slate-200/70 pt-2 text-[11px] text-slate-400 dark:border-slate-700/70 dark:text-slate-500">
              {rootsA.length === 0
                ? "Group A is empty — add courses with the main search box."
                : "Add at least one course to group B to see the comparison."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
