import { useCallback, useEffect, useState } from "react";
import { fetchCourseDetail } from "./api/client";
import { CourseDetailModal } from "./components/CourseDetailModal";
import { CourseGraph } from "./components/CourseGraph";
import { GraphLegend } from "./components/GraphLegend";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { useCourseGraph } from "./hooks/useCourseGraph";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useTheme } from "./hooks/useTheme";
import type { CourseDetail } from "./types/course";
import {
  defaultFilters,
  defaultSettings,
  parseFilterState,
  parseRoots,
  parseSettingsState,
  STORAGE_KEYS,
} from "./types/filters";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [filters, setFilters] = useLocalStorageState(
    STORAGE_KEYS.filters,
    defaultFilters,
    parseFilterState,
  );
  const [settings, setSettings] = useLocalStorageState(
    STORAGE_KEYS.settings,
    defaultSettings,
    parseSettingsState,
  );
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [roots, setRoots] = useLocalStorageState(STORAGE_KEYS.roots, [], parseRoots);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [detailCourseCode, setDetailCourseCode] = useState<string | null>(null);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [courseDetailLoading, setCourseDetailLoading] = useState(false);
  const [courseDetailError, setCourseDetailError] = useState<string | null>(null);

  const { nodes, boolNodes, ghostNodes, edges, truncated, hint, loading, error, filterOptions } = useCourseGraph(
    roots,
    filters,
    settings.engineeringStudent,
  );

  const addRoots = useCallback((codes: string[]) => {
    if (codes.length === 0) return;
    setRoots((current) => {
      const next = [...current];
      for (const code of codes) {
        if (!next.includes(code)) {
          next.push(code);
        }
      }
      return next;
    });
  }, []);

  const addRoot = useCallback((code: string) => {
    addRoots([code]);
  }, [addRoots]);

  const removeRoot = useCallback((code: string) => {
    setRoots((current) => current.filter((root) => root !== code));
    setSelectedNodeId(null);
  }, []);

  const clearRoots = useCallback(() => {
    setRoots([]);
    setSelectedNodeId(null);
  }, []);

  const handleAddCourse = useCallback(
    (code: string) => {
      setResolveError(null);
      addRoot(code);
    },
    [addRoot],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = nodes.find((item) => item.id === nodeId);
      if (node) addRoot(node.code);
    },
    [addRoot, nodes],
  );

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
    <div className="relative h-full w-full overflow-hidden">
      <CourseGraph
        nodes={nodes}
        boolNodes={boolNodes}
        ghostNodes={ghostNodes}
        edges={edges}
        settings={settings}
        selectedNodeId={selectedNodeId}
        theme={theme}
        onSelectNode={setSelectedNodeId}
        onNodeDoubleClick={handleNodeDoubleClick}
        onOpenCourseInfo={handleOpenCourseInfo}
      />

      <CourseDetailModal
        course={courseDetail}
        loading={courseDetailLoading}
        error={courseDetailError}
        onClose={handleCloseCourseInfo}
      />

      {(loading || error || truncated || resolveError || hint) && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#252a33]/90 dark:text-slate-300">
          {loading && "Loading courses..."}
          {!loading && error && error}
          {!loading && !error && resolveError && resolveError}
          {!loading && !error && !resolveError && hint && hint}
          {!loading && !error && !resolveError && !hint && truncated && "Graph truncated at 500 courses."}
        </div>
      )}

      {!loading && !error && roots.length === 0 && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#252a33]/80 dark:text-slate-400">
            Search a course to see its postrequisite tree.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <SearchPanel
          filters={filters}
          filterOptions={filterOptions}
          roots={roots}
          filtersExpanded={filtersExpanded}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onToggleFilters={() => setFiltersExpanded((expanded) => !expanded)}
          onAddCourse={handleAddCourse}
          onAddCourses={addRoots}
          onRemoveRoot={removeRoot}
          onClearRoots={clearRoots}
          onResolveError={setResolveError}
        />
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-10">
        <SettingsPanel
          open={settingsOpen}
          onToggle={() => setSettingsOpen((open) => !open)}
          settings={settings}
          theme={theme}
          onSettingsChange={(patch) =>
            setSettings((current) => ({ ...current, ...patch }))
          }
          onToggleTheme={toggleTheme}
        />
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10">
        <GraphLegend theme={theme} />
      </div>
    </div>
  );
}
