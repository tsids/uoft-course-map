export type Side = "top" | "bottom" | "left" | "right";

export type Point = { x: number; y: number };

const PAD = 16;

function extendFromSide(point: Point, side: Side, amount = PAD): Point {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - amount };
    case "bottom":
      return { x: point.x, y: point.y + amount };
    case "left":
      return { x: point.x - amount, y: point.y };
    case "right":
      return { x: point.x + amount, y: point.y };
  }
}

function isVerticalSide(side: Side) {
  return side === "top" || side === "bottom";
}

function samePoint(a: Point, b: Point) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function dedupePoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || !samePoint(last, point)) {
      result.push(point);
    }
  }
  return result;
}

function removeCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = result[result.length - 1]!;
    const current = points[i]!;
    const next = points[i + 1]!;
    const collinearX = Math.abs(prev.x - current.x) < 0.5 && Math.abs(current.x - next.x) < 0.5;
    const collinearY = Math.abs(prev.y - current.y) < 0.5 && Math.abs(current.y - next.y) < 0.5;
    if (!collinearX && !collinearY) {
      result.push(current);
    }
  }
  result.push(points[points.length - 1]!);
  return result;
}

export function buildOrthogonalPoints(
  source: Point,
  target: Point,
  sourceSide: Side,
  targetSide: Side,
): Point[] {
  const start = { ...source };
  const end = { ...target };
  const sourceOut = extendFromSide(start, sourceSide);
  const targetIn = extendFromSide(end, targetSide);

  const points: Point[] = [start, sourceOut];

  if (isVerticalSide(sourceSide) && isVerticalSide(targetSide)) {
    const midY = (sourceOut.y + targetIn.y) / 2;
    if (Math.abs(sourceOut.x - targetIn.x) < 1) {
      points.push({ x: sourceOut.x, y: targetIn.y });
    } else {
      points.push({ x: sourceOut.x, y: midY });
      points.push({ x: targetIn.x, y: midY });
    }
  } else if (!isVerticalSide(sourceSide) && !isVerticalSide(targetSide)) {
    const midX = (sourceOut.x + targetIn.x) / 2;
    if (Math.abs(sourceOut.y - targetIn.y) < 1) {
      points.push({ x: targetIn.x, y: sourceOut.y });
    } else {
      points.push({ x: midX, y: sourceOut.y });
      points.push({ x: midX, y: targetIn.y });
    }
  } else if (isVerticalSide(sourceSide)) {
    points.push({ x: sourceOut.x, y: targetIn.y });
  } else {
    points.push({ x: targetIn.x, y: sourceOut.y });
  }

  points.push(targetIn, end);
  return removeCollinear(dedupePoints(points));
}

export function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first!.x},${first!.y} ${rest.map((point) => `L ${point.x},${point.y}`).join(" ")}`;
}

export function buildOrthogonalPath(
  source: Point,
  target: Point,
  sourceSide: Side,
  targetSide: Side,
): string {
  return pointsToSvgPath(buildOrthogonalPoints(source, target, sourceSide, targetSide));
}
