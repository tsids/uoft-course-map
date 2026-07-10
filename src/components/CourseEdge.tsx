import { memo } from "react";
import { BaseEdge, type EdgeProps } from "@xyflow/react";
import type { GraphEdge } from "../types/graph";

type CourseEdgeData = {
  kind?: GraphEdge["kind"];
  /** Orthogonal, obstacle-avoiding path computed by ELK during layout. */
  path?: string;
};

function CourseEdgeComponent({ id, style, markerStart, markerEnd, data }: EdgeProps) {
  const { path } = (data ?? {}) as CourseEdgeData;
  if (!path) return null;

  return <BaseEdge id={id} path={path} style={style} markerStart={markerStart} markerEnd={markerEnd} />;
}

export const CourseEdge = memo(CourseEdgeComponent);
