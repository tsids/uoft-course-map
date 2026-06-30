import { Search, SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import type { FilterState } from "../types/filters";
import {
  BREADTHS,
  CAMPUSES,
  DEPARTMENTS,
  DISTRIBUTIONS,
  FACULTIES,
  SESSIONS,
  YEARS,
} from "../types/filters";

type SearchPanelProps = {
  filters: FilterState;
  moreFiltersOpen: boolean;
  onChange: (patch: Partial<FilterState>) => void;
  onToggleMoreFilters: () => void;
};

function hasDropdownFilters(filters: FilterState) {
  return (
    filters.campus !== "" ||
    filters.department !== "" ||
    filters.faculty !== "" ||
    filters.year !== "" ||
    filters.breadth !== "" ||
    filters.distribution !== "" ||
    filters.session !== ""
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs">
      <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchPanel({
  filters,
  moreFiltersOpen,
  onChange,
  onToggleMoreFilters,
}: SearchPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const filtersActive = hasDropdownFilters(filters);

  const collapseUnlessFocused = () => {
    const container = containerRef.current;
    if (container?.contains(document.activeElement)) return;
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={collapseUnlessFocused}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      className={[
        "pointer-events-auto rounded-xl border backdrop-blur-sm",
        "transition-[width,background-color,border-color,box-shadow,padding] duration-200 ease-out",
        open
          ? "w-[min(42rem,calc(100vw-2rem))] border-slate-200/80 bg-white/95 p-3 shadow-lg dark:border-slate-700/80 dark:bg-[#252a33]/95"
          : "w-56 border-slate-200/20 bg-white/15 p-1.5 shadow-none dark:border-slate-700/20 dark:bg-[#252a33]/15",
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
                "pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors",
                open ? "text-slate-400" : "text-slate-400/70",
              ].join(" ")}
            />
            <input
              type="search"
              placeholder={open ? "CSC148H1, linear algebra, databases..." : "Search courses..."}
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              className={[
                "w-full rounded-md border py-2 pl-8 pr-2 text-sm outline-none transition-colors duration-200",
                open
                  ? "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
                  : "border-transparent bg-transparent text-slate-500 placeholder:text-slate-400/80 focus:border-slate-200/40 dark:text-slate-400 dark:placeholder:text-slate-500/80 dark:focus:border-slate-600/40",
              ].join(" ")}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open filters"
            aria-pressed={filtersActive}
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition",
              filtersActive
                ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-400"
                : "border-slate-200/40 bg-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-600/40 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200",
            ].join(" ")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </label>

      <div
        className={[
          "flex flex-col gap-3 overflow-hidden transition-all duration-200 ease-out",
          open
            ? "mt-3 max-h-[70vh] opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="flex flex-wrap gap-2">
          <SelectField
            label="Session"
            value={filters.session}
            options={SESSIONS}
            onChange={(session) => onChange({ session })}
          />
          <SelectField
            label="Campus"
            value={filters.campus}
            options={CAMPUSES}
            onChange={(campus) => onChange({ campus: campus as FilterState["campus"] })}
          />
          <SelectField
            label="Year"
            value={filters.year}
            options={YEARS}
            onChange={(year) => onChange({ year })}
          />
          <SelectField
            label="Department"
            value={filters.department}
            options={DEPARTMENTS}
            onChange={(department) => onChange({ department })}
          />
        </div>

        {moreFiltersOpen && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <SelectField
              label="Breadth"
              value={filters.breadth}
              options={BREADTHS}
              onChange={(breadth) => onChange({ breadth })}
            />
            <SelectField
              label="Distribution"
              value={filters.distribution}
              options={DISTRIBUTIONS}
              onChange={(distribution) => onChange({ distribution })}
            />
            <SelectField
              label="Faculty"
              value={filters.faculty}
              options={FACULTIES}
              onChange={(faculty) => onChange({ faculty })}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleMoreFilters}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            {moreFiltersOpen ? "Fewer filters" : "More filters"}
          </button>
        </div>
      </div>
    </div>
  );
}
