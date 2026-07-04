import { useEffect, useState } from "react";
import { fetchFilterOptions, fetchGraph } from "../api/client";
import { mergeGraphResponses, type GraphDiff } from "../utils/graphDiff";
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
  fce: number | null,
  gpa: number | null,
  compareRoots: string[],
) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [boolNodes, setBoolNodes] = useState<BoolGraphNode[]>([]);
  const [ghostNodes, setGhostNodes] = useState<GraphNode[]>([]);
  const [missingNodes, setMissingNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(defaultFilterOptions);

  useEffect(() => {
    const controller = new AbortController();

    fetchFilterOptions(controller.signal)
      .then((options) => setFilterOptions(mergeFilterOptions(options)))
      .catch(() => {
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
      setDiff(null);
      setTruncated(false);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const comparing = compareRoots.length > 0 && roots.length > 0;
    const request = comparing
      ? Promise.all([
          fetchGraph(roots, filters, engineeringStudent, recursivePostrequisites, maxCourses, fce, gpa, controller.signal),
          fetchGraph(compareRoots, filters, engineeringStudent, recursivePostrequisites, maxCourses, fce, gpa, controller.signal),
        ]).then(([graphA, graphB]) => mergeGraphResponses(graphA, graphB))
      : fetchGraph(roots, filters, engineeringStudent, recursivePostrequisites, maxCourses, fce, gpa, controller.signal)
          .then((data) => ({ response: data, diff: null }));

    request
      .then(({ response: data, diff: nextDiff }) => {
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
        setDiff(nextDiff);
        setTruncated(data.truncated ?? false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setNodes([]);
        setBoolNodes([]);
        setGhostNodes([]);
        setMissingNodes([]);
        setEdges([]);
        setDiff(null);
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [roots, filters, engineeringStudent, recursivePostrequisites, maxCourses, fce, gpa, compareRoots]);

  return { nodes, boolNodes, ghostNodes, missingNodes, edges, diff, truncated, loading, error, filterOptions };
}
