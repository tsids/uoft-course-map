import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "../data/mockGraph";
import type { SettingsState } from "../types/filters";

type CourseGraphProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings: SettingsState;
  selectedNodeId: string | null;
  theme: "light" | "dark";
  onSelectNode: (id: string | null) => void;
};

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;

function getGraphCenter(nodes: GraphNode[]) {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.y + NODE_HEIGHT);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
}

function edgeColor(kind: GraphEdge["kind"], dark: boolean) {
  if (kind === "corequisite") return dark ? "#60a5fa" : "#2563eb";
  if (kind === "postrequisite") return dark ? "#a78bfa" : "#7c3aed";
  if (kind === "exclusion") return dark ? "#f87171" : "#dc2626";
  return dark ? "#94a3b8" : "#64748b";
}

function getPrerequisiteAncestors(
  nodeId: string,
  edges: GraphEdge[],
): Set<string> {
  const ancestors = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const edge of edges) {
      if (edge.kind !== "prerequisite" || edge.to !== current) continue;
      if (ancestors.has(edge.from)) continue;
      ancestors.add(edge.from);
      stack.push(edge.from);
    }
  }

  return ancestors;
}

export function CourseGraph({
  nodes,
  edges,
  settings,
  selectedNodeId,
  theme,
  onSelectNode,
}: CourseGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCenteredRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (hasCenteredRef.current) return;

    const container = containerRef.current;
    const center = getGraphCenter(nodes);
    if (!container || !center) return;

    const { width, height } = container.getBoundingClientRect();
    setViewport({
      scale: 1,
      x: width / 2 - center.x,
      y: height / 2 - center.y,
    });
    hasCenteredRef.current = true;
  }, [nodes]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest("[data-course-node]")) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.x,
        originY: viewport.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [viewport.x, viewport.y],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setViewport((current) => ({
      ...current,
      x: dragRef.current!.originX + dx,
      y: dragRef.current!.originY + dy,
    }));
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;

    setViewport((current) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * zoomFactor));
      const scaleRatio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: pointerX - (pointerX - current.x) * scaleRatio,
        y: pointerY - (pointerY - current.y) * scaleRatio,
      };
    });
  }, []);

  const visibleEdges = edges.filter((edge) => {
    if (edge.kind === "corequisite" && !settings.showCorequisites) return false;
    if (edge.kind === "postrequisite" && !settings.showPostrequisites) return false;
    if (edge.kind === "exclusion" && !settings.showExclusions) return false;
    return true;
  });

  const highlightedNodeIds = useMemo(() => {
    if (!settings.highlightPath || !selectedNodeId) return new Set<string>();
    const ancestors = getPrerequisiteAncestors(selectedNodeId, edges);
    ancestors.add(selectedNodeId);
    return ancestors;
  }, [edges, selectedNodeId, settings.highlightPath]);

  const isEdgeHighlighted = useCallback(
    (edge: GraphEdge) => {
      if (!settings.highlightPath || !selectedNodeId) return false;
      return highlightedNodeIds.has(edge.from) && highlightedNodeIds.has(edge.to);
    },
    [highlightedNodeIds, selectedNodeId, settings.highlightPath],
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab overflow-hidden bg-[#f4f6f8] active:cursor-grabbing dark:bg-[#1a1d23]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)",
          backgroundSize: `${40 * viewport.scale}px ${40 * viewport.scale}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />

      <svg className="absolute inset-0 h-full w-full">
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          {visibleEdges.map((edge) => {
            const from = nodes.find((node) => node.id === edge.from);
            const to = nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;

            const dark = theme === "dark";
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2 - 30;

            return (
              <g key={`${edge.from}-${edge.to}-${edge.kind}`}>
                <path
                  d={`M ${from.x + 90} ${from.y + 24} Q ${midX + 90} ${midY + 24} ${to.x + 90} ${to.y + 24}`}
                  fill="none"
                  stroke={edgeColor(edge.kind, dark)}
                  strokeWidth={
                    isEdgeHighlighted(edge) ? 3 : edge.kind === "corequisite" ? 2 : 1.5
                  }
                  strokeDasharray={
                    edge.kind === "corequisite"
                      ? "6 4"
                      : edge.kind === "exclusion"
                        ? "4 4"
                        : undefined
                  }
                  strokeOpacity={isEdgeHighlighted(edge) ? 1 : edge.kind === "postrequisite" ? 0.7 : 1}
                  markerEnd={edge.kind === "exclusion" ? undefined : "url(#arrowhead)"}
                />
              </g>
            );
          })}

          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" className="fill-slate-500 dark:fill-slate-400" />
            </marker>
          </defs>
        </g>
      </svg>

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {nodes.map((node) => {
          const selected = selectedNodeId === node.id;
          const onPath = highlightedNodeIds.has(node.id);
          return (
            <button
              key={node.id}
              type="button"
              data-course-node
              onClick={() => onSelectNode(selected ? null : node.id)}
              className={[
                "absolute w-[180px] rounded-lg border px-3 py-2 text-left shadow-sm transition",
                "bg-white hover:border-blue-400 dark:bg-[#252a33] dark:hover:border-blue-500",
                selected
                  ? "border-blue-500 ring-2 ring-blue-400/40"
                  : onPath
                    ? "border-emerald-400 ring-1 ring-emerald-400/30"
                    : "border-slate-200 dark:border-slate-700",
                !node.hasPrerequisites && settings.showNoPrerequisites
                  ? "outline outline-2 outline-amber-400/70"
                  : "",
              ].join(" ")}
              style={{ left: node.x, top: node.y }}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {node.code}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {node.name}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#252a33]/90 dark:text-slate-400">
        Drag to pan · Scroll to zoom · {Math.round(viewport.scale * 100)}%
      </div>
    </div>
  );
}
