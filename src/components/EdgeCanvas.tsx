import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStoreApi } from "@xyflow/react";
import type { GraphEdge } from "../types/graph";
import type { Point } from "../utils/edgeRouting";

export type DrawEdge = {
  id: string;
  source: string;
  path: string;
  points: Point[];
  kind: GraphEdge["kind"];
  highlighted: boolean;
  dimmed: boolean;
  hasReverseEdge: boolean;
};

type EdgeCanvasProps = {
  edges: DrawEdge[];
  dark: boolean;
};

type Palette = Record<string, string>;

const EDGE_COLOR_VARS = [
  "edge-prereq",
  "edge-prereq-dark",
  "edge-postreq",
  "edge-postreq-dark",
  "edge-coreq",
  "edge-coreq-dark",
  "edge-coreq-strong",
  "edge-coreq-strong-dark",
  "edge-exclusion",
  "edge-exclusion-dark",
  "edge-exclusion-strong",
  "edge-exclusion-strong-dark",
  "edge-active",
  "edge-active-dark",
];

const DEFAULT_EDGE_OPACITY = 0.6;
const DIMMED_ALPHA_FACTOR = 0.25;

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const palette: Palette = {};
  for (const name of EDGE_COLOR_VARS) {
    palette[name] = style.getPropertyValue(`--color-${name}`).trim();
  }
  return palette;
}

function edgePaint(
  kind: GraphEdge["kind"],
  highlighted: boolean,
  dark: boolean,
  palette: Palette,
): { color: string; width: number; dash: number[] } {
  const suffix = dark ? "-dark" : "";
  if (kind === "corequisite") {
    return {
      color: palette[highlighted ? `edge-coreq-strong${suffix}` : `edge-coreq${suffix}`],
      width: highlighted ? 3.5 : 1.5,
      dash: [6, 4],
    };
  }
  if (kind === "exclusion") {
    return {
      color: palette[highlighted ? `edge-exclusion-strong${suffix}` : `edge-exclusion${suffix}`],
      width: highlighted ? 3.5 : 1.5,
      dash: [4, 4],
    };
  }
  if (highlighted) {
    return { color: palette[`edge-active${suffix}`], width: 3.5, dash: [] };
  }
  if (kind === "postrequisite") {
    return { color: palette[`edge-postreq${suffix}`], width: 1.75, dash: [] };
  }
  return { color: palette[`edge-prereq${suffix}`], width: 2, dash: [] };
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  lineWidth: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const scale = 0.625 * lineWidth;
  const back = 5 * scale;
  const half = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(to.x - ux * back - uy * half, to.y - uy * back + ux * half);
  ctx.lineTo(to.x, to.y);
  ctx.lineTo(to.x - ux * back + uy * half, to.y - uy * back - ux * half);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = scale;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

export function EdgeCanvas({ edges, dark }: EdgeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const store = useStoreApi();
  const palette = useMemo(() => readPalette(), []);
  const pathCache = useRef(
    new Map<string, { d: string; startY: number | null; path2d: Path2D }>(),
  );
  const edgesRef = useRef<DrawEdge[]>([]);
  const darkRef = useRef(false);
  const frame = useRef<number | null>(null);

  const draw = useCallback(() => {
    frame.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { transform, nodeLookup } = store.getState();
    const [tx, ty, zoom] = transform;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * tx, dpr * ty);

    const cache = pathCache.current;
    const drawList = edgesRef.current;
    const isDark = darkRef.current;

    if (cache.size > drawList.length * 2 + 64) {
      const alive = new Set(drawList.map((edge) => edge.id));
      for (const id of cache.keys()) {
        if (!alive.has(id)) cache.delete(id);
      }
    }

    for (const pass of [false, true]) {
      for (const edge of drawList) {
        if (edge.highlighted !== pass) continue;
        const points = edge.points;
        let startY: number | null = null;
        if (
          edge.kind !== "exclusion" &&
          points.length >= 2 &&
          Math.abs(points[0].x - points[1].x) < 0.5 &&
          points[1].y > points[0].y + 1
        ) {
          const sourceNode = nodeLookup.get(edge.source);
          const sourceHeight = sourceNode?.measured.height;
          if (sourceNode && sourceHeight != null) {
            const bottom = sourceNode.internals.positionAbsolute.y + sourceHeight;
            const clamped = Math.min(bottom, (points[0].y + points[1].y) / 2);
            if (Math.abs(clamped - points[0].y) > 0.5) startY = clamped;
          }
        }
        let entry = cache.get(edge.id);
        if (!entry || entry.d !== edge.path || entry.startY !== startY) {
          const d =
            startY === null
              ? edge.path
              : edge.path.replace(/^M [-\d.]+,[-\d.]+/, `M ${points[0].x},${startY}`);
          entry = { d: edge.path, startY, path2d: new Path2D(d) };
          cache.set(edge.id, entry);
        }
        const paint = edgePaint(edge.kind, edge.highlighted, isDark, palette);
        ctx.globalAlpha =
          (edge.highlighted ? 1 : DEFAULT_EDGE_OPACITY) *
          (edge.dimmed ? DIMMED_ALPHA_FACTOR : 1);
        ctx.strokeStyle = paint.color;
        ctx.lineWidth = paint.width;
        ctx.setLineDash(paint.dash);
        ctx.stroke(entry.path2d);

        if (points.length >= 2) {
          ctx.fillStyle = paint.color;
          ctx.setLineDash([]);
          drawArrow(ctx, points[points.length - 2], points[points.length - 1], paint.width);
          if (edge.hasReverseEdge) {
            const start =
              startY === null ? points[0] : { x: points[0].x, y: startY };
            drawArrow(ctx, points[1], start, paint.width);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [palette, store]);

  const schedule = useCallback(() => {
    if (frame.current === null) {
      frame.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  useEffect(() => {
    edgesRef.current = edges;
    darkRef.current = dark;
    schedule();
  }, [edges, dark, schedule]);

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.transform !== previous.transform || state.nodes !== previous.nodes) {
          schedule();
        }
      }),
    [store, schedule],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(parent.clientWidth * dpr);
      canvas.height = Math.round(parent.clientHeight * dpr);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      schedule();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [schedule]);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    },
    [],
  );

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />;
}
