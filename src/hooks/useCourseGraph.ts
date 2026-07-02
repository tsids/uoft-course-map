import { useEffect, useState } from "react";
import { fetchFilterOptions, fetchGraph } from "../api/client";
import type { BoolGraphNode, FilterOptions, GraphEdge, GraphNode } from "../types/graph";
import {
  BREADTHS,
  CAMPUSES,
  DELIVERY_MODES,
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
  deliveryModes: [...DELIVERY_MODES],
  sessions: [...SESSIONS],
};

function mergeFilterOptions(options: FilterOptions): FilterOptions {
  return {
    ...options,
    subjectAreas: options.subjectAreas ?? [],
    years: [...YEARS],
    breadths: [...BREADTHS],
    distributions: [...DISTRIBUTIONS],
    deliveryModes: [...DELIVERY_MODES],
  };
}

export function useCourseGraph(
  roots: string[],
  filters: FilterState,
  engineeringStudent: boolean,
  recursivePostrequisites: boolean,
  maxCourses: number,
) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [boolNodes, setBoolNodes] = useState<BoolGraphNode[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GraphNode[]>([]);
  const [missingNodes, setMissingNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [truncated, setTruncated] = useState(false);
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
      setMissingNodes([]);
      setEdges([]);
      setTruncated(false);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchGraph(roots, filters, engineeringStudent, recursivePostrequisites, maxCourses, controller.signal)
      .then((data) => {
        const apiNodes = data.nodes ?? [];
        const apiGhosts = data.ghostNodes ?? [];
        const apiMissing = data.missingNodes ?? [];
        const filteredNodes = engineeringStudent
          ? apiNodes.filter((node) => node.openToEngineering)
          : apiNodes;
        const filteredGhosts = engineeringStudent
          ? apiGhosts.filter((node) => node.openToEngineering)
          : apiGhosts;
        const filteredMissing = engineeringStudent
          ? apiMissing.filter((node) => node.openToEngineering)
          : apiMissing;
        setNodes(filteredNodes);
        setBoolNodes(data.boolNodes ?? []);
        setGhostNodes(filteredGhosts);
        setMissingNodes(filteredMissing);
        setEdges(data.edges ?? []);
        setTruncated(data.truncated ?? false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setNodes([]);
        setBoolNodes([]);
        setGhostNodes([]);
        setMissingNodes([]);
        setEdges([]);
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [roots, filters, engineeringStudent, recursivePostrequisites, maxCourses]);

  return { nodes, boolNodes, ghostNodes, missingNodes, edges, truncated, loading, error, filterOptions };
}
