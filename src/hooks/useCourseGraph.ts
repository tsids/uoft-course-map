import { useEffect, useState } from "react";
import { fetchFilterOptions, fetchGraph } from "../api/client";
import type { BoolGraphNode, FilterOptions, GraphEdge, GraphNode } from "../types/graph";
import {
  BREADTHS,
  CAMPUSES,
  DISTRIBUTIONS,
  FACULTIES,
  SESSIONS,
  YEARS,
  type FilterState,
} from "../types/filters";

const defaultFilterOptions: FilterOptions = {
  campuses: [...CAMPUSES],
  subjectAreas: [],
  faculties: [...FACULTIES],
  years: [...YEARS],
  breadths: [...BREADTHS],
  distributions: [...DISTRIBUTIONS],
  sessions: [...SESSIONS],
};

function mergeFilterOptions(options: FilterOptions): FilterOptions {
  return {
    ...options,
    subjectAreas: options.subjectAreas ?? [],
    years: [...YEARS],
    breadths: [...BREADTHS],
    distributions: [...DISTRIBUTIONS],
  };
}

export function useCourseGraph(
  roots: string[],
  filters: FilterState,
  engineeringStudent: boolean,
) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [boolNodes, setBoolNodes] = useState<BoolGraphNode[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(defaultFilterOptions);

  useEffect(() => {
    const controller = new AbortController();

    fetchFilterOptions(controller.signal)
      .then((options) => setFilterOptions(mergeFilterOptions(options)))
      .catch(() => {
        // Keep the static defaults when the API is unavailable.
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const hasQuery =
      roots.length > 0 || filters.showAllNoPrereqCourses || filters.subjectAreas.length > 0;
    if (!hasQuery) {
      setNodes([]);
      setBoolNodes([]);
      setGhostNodes([]);
      setEdges([]);
      setTruncated(false);
      setHint(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchGraph(roots, filters, engineeringStudent, controller.signal)
      .then((data) => {
        const apiNodes = data.nodes ?? [];
        const apiGhosts = data.ghostNodes ?? [];
        const filteredNodes = engineeringStudent
          ? apiNodes.filter((node) => node.openToEngineering)
          : apiNodes;
        const filteredGhosts = engineeringStudent
          ? apiGhosts.filter((node) => node.openToEngineering)
          : apiGhosts;
        setNodes(filteredNodes);
        setBoolNodes(data.boolNodes ?? []);
        setGhostNodes(filteredGhosts);
        setEdges(data.edges ?? []);
        setTruncated(data.truncated ?? false);
        setHint(data.hint ?? null);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setNodes([]);
        setBoolNodes([]);
        setGhostNodes([]);
        setEdges([]);
        setHint(null);
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [roots, filters, engineeringStudent]);

  return { nodes, boolNodes, ghostNodes, edges, truncated, hint, loading, error, filterOptions };
}
