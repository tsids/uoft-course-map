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
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Header } from "./components/Header";
import { useCourseGraph } from "./hooks/useCourseGraph";
import { useIsMobile } from "./hooks/useIsMobile";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useTheme } from "./hooks/useTheme";
import type { CourseDetail } from "./types/course";
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

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
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
  const [filtersExpanded, setFiltersExpanded] = useState(
    () =>
      typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  const [settingsOpen, setSettingsOpen] = useLocalStorageState(
    STORAGE_KEYS.settingsOpen,
    !isMobile,
    parseBooleanFlag,
  );
  const [standingOpen, setStandingOpen] = useLocalStorageState(
    STORAGE_KEYS.standingOpen,
    !isMobile,
    parseBooleanFlag,
  );
  const [legendOpen, setLegendOpen] = useLocalStorageState(
    STORAGE_KEYS.legendOpen,
    false,
    parseBooleanFlag,
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
  }, [roots, setFilters]);

  const addRoot = useCallback((code: string) => {
    addRoots([code]);
  }, [addRoots]);

  const removeRoot = useCallback((code: string) => {
    setRoots((current) => current.filter((root) => root !== code));
    setSelectedNodeIds([]);
  }, []);

  const clearRoots = useCallback(() => {
    setRoots([]);
    setSelectedNodeIds([]);
  }, []);

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

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((item) => item.id === nodeId);
      if (node) addRoot(node.code);
    },
    [addRoot, nodes],
  );

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
  }, [filters.excludeCourses, setFilters]);

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
            settings={settings}
            selectedNodeIds={selectedNodeIds}
            theme={theme}
            onSelectNode={handleSelectNode}
            onNodeDoubleClick={handleNodeDoubleClick}
            onAddCourse={addRoot}
            onOpenCourseInfo={handleOpenCourseInfo}
            onHideCourse={handleHideCourse}
          />
        </Suspense>

        <CourseDetailModal
          course={courseDetail}
          loading={courseDetailLoading}
          error={courseDetailError}
          onClose={handleCloseCourseInfo}
        />

        {statusVisible && (
          <div className="pointer-events-none absolute bottom-4 left-14 z-10 rounded-md border border-slate-200 bg-surface/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#252a33]/90 dark:text-slate-300">
            {loading && "Loading courses..."}
            {!loading && error && error}
            {!loading && !error && resolveError && resolveError}
            {!loading && !error && !resolveError && truncated &&
            `Graph truncated at ${settings.maxCourses} courses.`}
          </div>
        )}

        {!loading && !error && roots.length === 0 && nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-lg border border-slate-200 bg-surface/80 px-4 py-3 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#252a33]/80 dark:text-slate-400">
              Search a course or subject area to get started.
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col items-start gap-2">
          <SearchPanel
            filters={filters}
            filterOptions={filterOptions}
            roots={roots}
            filtersExpanded={filtersExpanded}
            onChange={handleFiltersChange}
            onToggleFilters={() => setFiltersExpanded((expanded) => !expanded)}
            onAddCourse={handleAddCourse}
            onAddCourses={addRoots}
            onRemoveRoot={removeRoot}
            onClearRoots={clearRoots}
            onResolveError={setResolveError}
          />
          <ComparePanel
            active={compareMode}
            onToggle={toggleCompareMode}
            rootsA={roots}
            rootsB={compareRoots}
            onAddB={addCompareRoots}
            onRemoveB={removeCompareRoot}
            onClearB={clearCompareRoots}
            onSwap={swapCompareGroups}
            summary={diff?.summary ?? null}
            onOpenCourseInfo={handleOpenCourseInfo}
            onResolveError={setResolveError}
          />
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

        <div className="pointer-events-none absolute bottom-4 right-4 z-10">
          <GraphLegend
            open={legendOpen}
            onToggle={() => setLegendOpen((open) => !open)}
            theme={theme}
            compareActive={compareMode && diff !== null}
          />
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
