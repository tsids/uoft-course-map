export type Point = { x: number; y: number };

const CORNER_RADIUS = 12;

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

export function roundedPath(points: Point[]): string {
  const cleaned = removeCollinear(dedupePoints(points));
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return `M ${cleaned[0]!.x},${cleaned[0]!.y}`;

  const commands: string[] = [`M ${cleaned[0]!.x},${cleaned[0]!.y}`];

  for (let i = 1; i < cleaned.length - 1; i += 1) {
    const prev = cleaned[i - 1]!;
    const current = cleaned[i]!;
    const next = cleaned[i + 1]!;

    const incomingLength = Math.hypot(current.x - prev.x, current.y - prev.y);
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(CORNER_RADIUS, incomingLength / 2, outgoingLength / 2);

    const incomingPoint = {
      x: current.x + (prev.x === current.x ? 0 : prev.x < current.x ? -radius : radius),
      y: current.y + (prev.y === current.y ? 0 : prev.y < current.y ? -radius : radius),
    };
    const outgoingPoint = {
      x: current.x + (next.x === current.x ? 0 : next.x < current.x ? -radius : radius),
      y: current.y + (next.y === current.y ? 0 : next.y < current.y ? -radius : radius),
    };

    commands.push(`L ${incomingPoint.x},${incomingPoint.y}`);
    commands.push(`Q ${current.x},${current.y} ${outgoingPoint.x},${outgoingPoint.y}`);
  }

  const last = cleaned[cleaned.length - 1]!;
  commands.push(`L ${last.x},${last.y}`);
  return commands.join(" ");
}
