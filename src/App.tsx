import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { fetchCourseDetail } from "./api/client";
import { ComparePanel } from "./components/ComparePanel";
import { CourseDetailModal } from "./components/CourseDetailModal";
import { DisclaimerBanner } from "./components/DisclaimerBanner";
import { FceGpaPanel } from "./components/FceGpaPanel";
const CourseGraph = lazy(() =>
  import("./components/CourseGraph").then((module) => ({ default: module.CourseGraph })),
);
import { GraphLegend } from "./components/GraphLegend";
import { Hint } from "./components/Hint";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Header } from "./components/Header";
import { useCourseGraph } from "./hooks/useCourseGraph";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useTheme } from "./hooks/useTheme";
import type { CourseDetail } from "./types/course";
import type { GraphEdge } from "./types/graph";
import {
  defaultAcademic,
  defaultFilters,
  defaultSettings,
  FILTERS_TTL_MS,
  parseAcademicState,
  parseBooleanFlag,
  parseFilterState,
  parseRoots,
  parseSettingsState,
  STORAGE_KEYS,
} from "./types/filters";
import { totalFce } from "./utils/courseCode";
import { track, trackFilterChange, trackSettingsChange } from "./utils/analytics";
import type { FilterState, SettingsState } from "./types/filters";

const NO_COMPARE_ROOTS: string[] = [];

const TOGGLEABLE_EDGE_KINDS: GraphEdge["kind"][] = [
  "prerequisite",
  "corequisite",
  "exclusion",
];

function parseHiddenEdgeKinds(stored: unknown): GraphEdge["kind"][] | null {
  if (!Array.isArray(stored)) return null;
  return stored.filter((kind): kind is GraphEdge["kind"] =>
    TOGGLEABLE_EDGE_KINDS.includes(kind as GraphEdge["kind"]),
  );
}

type HintId = "search" | "legend" | "compare";

const HINT_IDS: HintId[] = ["search", "legend", "compare"];

const HINT_GLOW = "rounded-2xl shadow-[0_0_28px_8px_rgba(96,165,250,0.55)]";

function parseHintsDismissed(stored: unknown): HintId[] | null {
  if (!Array.isArray(stored)) return null;
  return stored.filter((id): id is HintId => HINT_IDS.includes(id as HintId));
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [supportPanel, setSupportPanel] = useState<"feedback" | null>(null);
  const [filters, setFilters] = useLocalStorageState(
    STORAGE_KEYS.filters,
    defaultFilters,
    parseFilterState,
    FILTERS_TTL_MS,
  );
  const [settings, setSettings] = useLocalStorageState(
    STORAGE_KEYS.settings,
    defaultSettings,
    parseSettingsState,
  );
  const [academic, setAcademic] = useLocalStorageState(
    STORAGE_KEYS.academic,
    defaultAcademic,
    parseAcademicState,
  );
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useLocalStorageState(
    STORAGE_KEYS.settingsOpen,
    false,
    parseBooleanFlag,
  );
  const [standingOpen, setStandingOpen] = useLocalStorageState(
    STORAGE_KEYS.standingOpen,
    false,
    parseBooleanFlag,
  );
  const [legendOpen, setLegendOpen] = useLocalStorageState(
    STORAGE_KEYS.legendOpen,
    false,
    parseBooleanFlag,
  );
  const [hiddenEdgeKinds, setHiddenEdgeKinds] = useLocalStorageState<GraphEdge["kind"][]>(
    STORAGE_KEYS.hiddenEdgeKinds,
    [],
    parseHiddenEdgeKinds,
  );
  const [hintsDismissed, setHintsDismissed] = useLocalStorageState<HintId[]>(
    STORAGE_KEYS.hintsDismissed,
    [],
    parseHintsDismissed,
  );
  const dismissHint = useCallback(
    (id: HintId) => {
      setHintsDismissed((current) =>
        current.includes(id) ? current : [...current, id],
      );
    },
    [setHintsDismissed],
  );
  const handleToggleEdgeKind = useCallback(
    (kind: GraphEdge["kind"]) => {
      setHiddenEdgeKinds((current) =>
        current.includes(kind)
          ? current.filter((k) => k !== kind)
          : [...current, kind],
      );
    },
    [setHiddenEdgeKinds],
  );
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [roots, setRoots] = useLocalStorageState(STORAGE_KEYS.roots, [], parseRoots);
  const [compareMode, setCompareMode] = useLocalStorageState(
    STORAGE_KEYS.compareMode,
    false,
    parseBooleanFlag,
  );
  const [compareRoots, setCompareRoots] = useLocalStorageState(
    STORAGE_KEYS.compareRoots,
    [],
    parseRoots,
  );
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveErrorFading, setResolveErrorFading] = useState(false);

  useEffect(() => {
    setResolveErrorFading(false);
    if (!resolveError) return;
    const fadeTimer = setTimeout(() => setResolveErrorFading(true), 3000);
    const clearTimer = setTimeout(() => setResolveError(null), 3500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [resolveError]);
  const [detailCourseCode, setDetailCourseCode] = useState<string | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [courseDetailLoading, setCourseDetailLoading] = useState(false);
  const [courseDetailError, setCourseDetailError] = useState<string | null>(null);

  const activeCompareRoots = useMemo(
    () => (compareMode ? compareRoots : NO_COMPARE_ROOTS),
    [compareMode, compareRoots],
  );

  const autoFce = useMemo(() => totalFce(roots), [roots]);
  const effectiveFce = academic.fceOverride ?? autoFce;
  const fceParam = roots.length > 0 || academic.fceOverride !== null ? effectiveFce : null;

  const { nodes, boolNodes, ghostNodes, missingNodes, edges, diff, truncated, loading, error, filterOptions } = useCourseGraph(
    roots,
    filters,
    settings.engineeringStudent,
    settings.recursivePostrequisites,
    settings.maxCourses,
    fceParam,
    academic.gpa,
    activeCompareRoots,
  );

  const statusVisible = Boolean(loading || error || resolveError || truncated);

  const [layoutPending, setLayoutPending] = useState(true);
  const graphReady = !loading && !error;
  const graphDisplayed = graphReady && !layoutPending;
  const showSearchHint =
    graphReady && !hintsDismissed.includes("search") && roots.length === 0;
  const showLegendHint =
    graphDisplayed && !hintsDismissed.includes("legend") && roots.length > 0;
  const showCompareHint =
    graphReady &&
    hintsDismissed.includes("legend") &&
    !hintsDismissed.includes("compare") &&
    roots.length > 0;
  const spotlightActive = showSearchHint;

  useEffect(() => {
    if (showLegendHint) setLegendOpen(true);
  }, [showLegendHint, setLegendOpen]);

  const emptyCanvas =
    graphReady &&
    nodes.length === 0 &&
    ghostNodes.length === 0 &&
    missingNodes.length === 0 &&
    roots.length === 0 &&
    !filters.showAllNoPrereqCourses &&
    filters.subjectAreas.length === 0;

  const [everUsedApp, setEverUsedApp] = useState(false);
  useEffect(() => {
    if (roots.length > 0 || filters.subjectAreas.length > 0 || filters.showAllNoPrereqCourses) {
      setEverUsedApp(true);
    }
  }, [roots.length, filters.subjectAreas.length, filters.showAllNoPrereqCourses]);

  const addRoots = useCallback((codes: string[]) => {
    if (codes.length === 0) return;
    for (const code of codes) {
      if (!roots.includes(code)) track("course-added", { code });
    }
    setRoots((current) => {
      const next = [...current];
      for (const code of codes) {
        if (!next.includes(code)) {
          next.push(code);
        }
      }
      return next;
    });
    setFilters((current) =>
      current.excludeCourses.some((code) => codes.includes(code))
        ? {
            ...current,
            excludeCourses: current.excludeCourses.filter((code) => !codes.includes(code)),
          }
        : current,
    );
  }, [roots, setFilters, setRoots]);

  const addRoot = useCallback((code: string) => {
    addRoots([code]);
  }, [addRoots]);

  const removeRoot = useCallback((code: string) => {
    setRoots((current) => current.filter((root) => root !== code));
    setSelectedNodeIds([]);
  }, [setRoots]);

  const clearRoots = useCallback(() => {
    setRoots([]);
    setSelectedNodeIds([]);
  }, [setRoots]);

  const handleSelectNode = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedNodeIds([]);
      return;
    }
    setSelectedNodeIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const handleAddCourse = useCallback(
    (code: string) => {
      setResolveError(null);
      addRoot(code);
    },
    [addRoot],
  );

  const handleFiltersChange = useCallback(
    (patch: Partial<FilterState>) => {
      trackFilterChange(filters, patch);
      setFilters((current) => ({ ...current, ...patch }));
    },
    [filters, setFilters],
  );

  const handleSettingsChange = useCallback(
    (patch: Partial<SettingsState>) => {
      trackSettingsChange(settings, patch);
      setSettings((current) => ({ ...current, ...patch }));
    },
    [settings, setSettings],
  );

  const toggleCompareMode = useCallback(() => {
    setCompareMode((current) => !current);
  }, [setCompareMode]);

  const addCompareRoots = useCallback((codes: string[]) => {
    if (codes.length === 0) return;
    setCompareRoots((current) => {
      const next = [...current];
      for (const code of codes) {
        if (!next.includes(code)) {
          next.push(code);
        }
      }
      return next;
    });
  }, [setCompareRoots]);

  const removeCompareRoot = useCallback((code: string) => {
    setCompareRoots((current) => current.filter((root) => root !== code));
  }, [setCompareRoots]);

  const clearCompareRoots = useCallback(() => {
    setCompareRoots([]);
  }, [setCompareRoots]);

  const swapCompareGroups = useCallback(() => {
    setRoots(compareRoots);
    setCompareRoots(roots);
    setSelectedNodeIds([]);
  }, [compareRoots, roots, setCompareRoots, setRoots]);

  const handleHideCourse = useCallback((code: string) => {
    if (!filters.excludeCourses.includes(code)) {
      track("exclude", { type: "course", value: code });
    }
    setFilters((current) =>
      current.excludeCourses.includes(code)
        ? current
        : { ...current, excludeCourses: [...current.excludeCourses, code] },
    );
    setRoots((current) => current.filter((root) => root !== code));
    setSelectedNodeIds([]);
  }, [filters.excludeCourses, setFilters, setRoots]);

  const handleOpenCourseInfo = useCallback((code: string) => {
    setDetailCourseCode(code);
  }, []);

  const handleCloseCourseInfo = useCallback(() => {
    setDetailCourseCode(null);
    setCourseDetail(null);
    setCourseDetailError(null);
    setCourseDetailLoading(false);
  }, []);

  useEffect(() => {
    if (!detailCourseCode) return;

    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setCourseDetailLoading(true);
      setCourseDetailError(null);
      setCourseDetail(null);

      fetchCourseDetail(detailCourseCode, controller.signal)
        .then(setCourseDetail)
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setCourseDetailError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setCourseDetailLoading(false);
          }
        });
    });

    return () => controller.abort();
  }, [detailCourseCode]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Header
        activePanel={supportPanel}
        onOpenFeedback={() => setSupportPanel("feedback")}
        onClosePanel={() => setSupportPanel(null)}
        repositoryUrl="https://github.com/tsids/uoft-course-map"
        kofiUrl="https://ko-fi.com/tsids"
        dataUpdatedAt={filterOptions.dataUpdatedAt}
      />

      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <CourseGraph
            nodes={nodes}
            boolNodes={boolNodes}
            ghostNodes={ghostNodes}
            missingNodes={missingNodes}
            edges={edges}
            diffMap={diff?.map ?? null}
            campusFilter={filters.campus}
            settings={settings}
            selectedNodeIds={selectedNodeIds}
            hiddenEdgeKinds={hiddenEdgeKinds}
            theme={theme}
            fitViewKey={`${roots.join(",")}::${activeCompareRoots.join(",")}::${filters.subjectAreas.join(",")}::${filters.showAllNoPrereqCourses}`}
            onSelectNode={handleSelectNode}
            onAddCourse={addRoot}
            onOpenCourseInfo={handleOpenCourseInfo}
            onHideCourse={handleHideCourse}
            onLayoutPendingChange={setLayoutPending}
          />
        </Suspense>

        <CourseDetailModal
          course={courseDetail}
          loading={courseDetailLoading}
          error={courseDetailError}
          onClose={handleCloseCourseInfo}
        />

        {statusVisible && (
          <div className={`pointer-events-none absolute bottom-4 ${nodes.length + ghostNodes.length + missingNodes.length > 0 ? "left-14" : "left-4"} z-10 rounded-md border border-slate-200 bg-surface/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-panel/90 dark:text-slate-300 ${!loading && !error && resolveError ? `transition-opacity duration-500 ${resolveErrorFading ? "opacity-0" : "opacity-100"}` : ""}`}>
            {loading && "Loading courses..."}
            {!loading && error && error}
            {!loading && !error && resolveError && resolveError}
            {!loading && !error && !resolveError && truncated &&
            `Graph truncated at ${settings.maxCourses} courses.`}
          </div>
        )}

        {!loading && !error && nodes.length === 0 && ghostNodes.length === 0 && missingNodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="pointer-events-auto select-text rounded-xl border border-slate-200 bg-surface/80 px-6 py-4 text-base text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-panel/80 dark:text-slate-400">
              {roots.length === 0 && !filters.showAllNoPrereqCourses && filters.subjectAreas.length === 0
                ? "Search a course or subject area to get started."
                : "No courses match the current filters. Try removing or relaxing some filters."}
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
          <div className="relative z-20">
            <SearchPanel
              highlight={emptyCanvas && !everUsedApp}
              filters={filters}
              filterOptions={filterOptions}
              roots={roots}
              filtersExpanded={filtersExpanded}
              onChange={(patch) => {
                dismissHint("search");
                handleFiltersChange(patch);
              }}
              onToggleFilters={() => {
                dismissHint("search");
                setFiltersExpanded((expanded) => !expanded);
              }}
              onAddCourse={(code) => {
                dismissHint("search");
                handleAddCourse(code);
              }}
              onAddCourses={(codes) => {
                dismissHint("search");
                addRoots(codes);
              }}
              onRemoveRoot={removeRoot}
              onClearRoots={clearRoots}
              onResolveError={setResolveError}
            />
          </div>
          <div className={["relative z-10", showCompareHint ? HINT_GLOW : ""].filter(Boolean).join(" ")}>
            <ComparePanel
              active={compareMode}
              onToggle={() => {
                dismissHint("compare");
                toggleCompareMode();
              }}
              rootsA={roots}
              onRemoveA={removeRoot}
              rootsB={compareRoots}
              onAddB={addCompareRoots}
              onRemoveB={removeCompareRoot}
              onClearB={clearCompareRoots}
              onSwap={swapCompareGroups}
              summary={diff?.summary ?? null}
              onOpenCourseInfo={handleOpenCourseInfo}
              onResolveError={setResolveError}
            />
            {showCompareHint && (
              <Hint
                text="Compare two sets of courses to see what each unlocks."
                arrow="top"
                className="left-0 top-[calc(100%+0.5rem)] w-60"
                arrowClassName="-top-1.5 left-6"
                onDismiss={() => dismissHint("compare")}
              />
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          <SettingsPanel
            open={settingsOpen}
            onToggle={() => setSettingsOpen((open) => !open)}
            settings={settings}
            theme={theme}
            onSettingsChange={handleSettingsChange}
            onToggleTheme={toggleTheme}
          />
          <FceGpaPanel
            open={standingOpen}
            onToggle={() => setStandingOpen((open) => !open)}
            fce={effectiveFce}
            fceOverridden={academic.fceOverride !== null}
            gpa={academic.gpa}
            onFceChange={(fceOverride) =>
              setAcademic((current) => ({ ...current, fceOverride }))
            }
            onGpaChange={(gpa) => setAcademic((current) => ({ ...current, gpa }))}
          />

        </div>

        <div
          className={[
            "pointer-events-none absolute bottom-4 right-4",
            showLegendHint ? "z-30" : "z-10",
            showLegendHint ? HINT_GLOW : "",
          ].join(" ")}
        >
          <GraphLegend
            open={legendOpen}
            onToggle={() => {
              dismissHint("legend");
              setLegendOpen((open) => !open);
            }}
            theme={theme}
            compareActive={compareMode && diff !== null}
            hiddenEdgeKinds={hiddenEdgeKinds}
            onToggleEdgeKind={(kind) => {
              dismissHint("legend");
              handleToggleEdgeKind(kind);
            }}
          />
        </div>

        {spotlightActive && (
          <Hint
            text="Search a course or subject area to build your map."
            arrow="top"
            className="left-4 top-[7.5rem]"
            onDismiss={() => dismissHint("search")}
          />
        )}
        {showLegendHint && (
          <Hint
            text="Interactive legend, toggle graph features."
            arrow={legendOpen ? "right" : "bottom"}
            className={legendOpen ? "bottom-6 right-[15.5rem]" : "bottom-[4.75rem] right-4"}
            onDismiss={() => dismissHint("legend")}
          />
        )}
      </div>

      {!spotlightActive && <DisclaimerBanner />}
    </div>
  );
}
