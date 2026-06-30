import { useMemo, useState } from "react";
import { CourseGraph } from "./components/CourseGraph";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { mockEdges, mockNodes } from "./data/mockGraph";
import { useTheme } from "./hooks/useTheme";
import {
  defaultFilters,
  defaultSettings,
  type FilterState,
  type SettingsState,
} from "./types/filters";

function matchesSearch(value: string, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return value.toLowerCase().includes(normalized);
}

function filterNodes(nodes: typeof mockNodes, filters: FilterState, settings: SettingsState) {
  return nodes.filter((node) => {
    if (!matchesSearch(node.code, filters.search) && !matchesSearch(node.name, filters.search)) {
      return false;
    }
    if (filters.campus && node.campus !== filters.campus) return false;
    if (filters.department && node.department !== filters.department) return false;
    if (filters.faculty && node.faculty !== filters.faculty) return false;
    if (filters.year && node.year !== filters.year) return false;
    if (filters.breadth && node.breadth !== filters.breadth) return false;
    if (filters.distribution && node.distribution !== filters.distribution) return false;
    if (filters.session && !node.sessions.includes(filters.session)) return false;
    if (settings.engineeringStudent && !node.openToEngineering) return false;
    return true;
  });
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const visibleNodes = useMemo(
    () => filterNodes(mockNodes, filters, settings),
    [filters, settings],
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      mockEdges.filter(
        (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
      ),
    [visibleNodeIds],
  );

  return (
    <div className="relative h-full w-full overflow-hidden">
      <CourseGraph
        nodes={visibleNodes}
        edges={visibleEdges}
        settings={settings}
        selectedNodeId={selectedNodeId}
        theme={theme}
        onSelectNode={setSelectedNodeId}
      />

      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <SearchPanel
          filters={filters}
          moreFiltersOpen={moreFiltersOpen}
          onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onToggleMoreFilters={() => setMoreFiltersOpen((open) => !open)}
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
    </div>
  );
}
