import { BaseEdge, type EdgeProps } from "@xyflow/react";
import type { GraphEdge } from "../types/graph";
import { buildOrthogonalPath, type Side } from "../utils/edgeRouting";

type CourseEdgeData = {
  kind?: GraphEdge["kind"];
  sourceAnchor?: [number, number];
  targetAnchor?: [number, number];
  sourceSide?: Side;
  targetSide?: Side;
};

export function CourseEdge({ id, style, markerEnd, data }: EdgeProps) {
  const { sourceAnchor, targetAnchor, sourceSide, targetSide } = (data ?? {}) as CourseEdgeData;
  if (!sourceAnchor || !targetAnchor || !sourceSide || !targetSide) {
    return null;
  }

  const path = buildOrthogonalPath(
    { x: sourceAnchor[0], y: sourceAnchor[1] },
    { x: targetAnchor[0], y: targetAnchor[1] },
    sourceSide,
    targetSide,
  );

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
