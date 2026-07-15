import { EyeOff, Info, Plus } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DiffSide, GraphNode } from "../types/graph";

const COARSE_POINTER =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(pointer: coarse)").matches
    : false;

export type CourseNodeData = {
  course: GraphNode;
  selected?: boolean;
  highlighted?: boolean;
  diff?: DiffSide | null;
  roleTint?: "prerequisite" | "postrequisite" | null;
  showNoPrerequisites?: boolean;
  visible?: boolean;
  onOpenInfo?: (code: string) => void;
  onHide?: (code: string) => void;
  onAdd?: (code: string) => void;
};

function CourseNodeComponent({ data }: NodeProps) {
  const { course, selected, highlighted, diff, roleTint, showNoPrerequisites, onOpenInfo, onHide, onAdd } =
    data as CourseNodeData;

  const kind: "prerequisite" | "postrequisite" | null = course.isGhost
    ? "postrequisite"
    : roleTint ?? null;

  const roleBorder =
    kind === "postrequisite"
      ? "border-purple-300 dark:border-purple-400/45"
      : "border-slate-200 dark:border-slate-700";
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<(() => void) | null>(null);
  const [hovered, setHovered] = useState(false);
  const showActions = hovered || COARSE_POINTER;

  useEffect(() => {
    addRef.current = onAdd ? () => onAdd(course.code) : null;
  }, [onAdd, course.code]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const handleDoubleClick = (event: MouseEvent) => {
      event.stopPropagation();
      addRef.current?.();
    };
    element.addEventListener("dblclick", handleDoubleClick);
    return () => element.removeEventListener("dblclick", handleDoubleClick);
  }, []);

  const diffBadges =
    diff === "a" ? ["A"] : diff === "b" ? ["B"] : diff === "both" ? ["A", "B"] : [];

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "group relative w-45 rounded-lg border px-3 py-2 text-left shadow-sm transition-[opacity,border-color,box-shadow,background-color]",
        kind === "postrequisite"
          ? "bg-postreq dark:bg-postreq-dark"
          : "bg-surface dark:bg-panel",
        selected
          ? "is-selected border-yellow-600 ring-2 ring-yellow-400/60 dark:border-yellow-300 dark:ring-yellow-300/50"
          : course.isRoot
            ? "is-root border-blue-500 ring-2 ring-blue-400/40"
            : highlighted
              ? "border-emerald-500 ring-[3px] ring-emerald-400/70 dark:border-emerald-400"
              : diff === "a"
                ? "border-orange-400 dark:border-orange-500/70"
                : diff === "b"
                  ? "border-rose-400 dark:border-rose-500/70"
                  : roleBorder,
        !course.hasPrerequisites && showNoPrerequisites
          ? "outline-2 outline-cyan-500/70"
          : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
      />

      {diffBadges.length > 0 && (
        <span className="absolute -left-2 -top-2 flex gap-0.5">
          {diffBadges.map((badge) => (
            <span
              key={badge}
              className={[
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white shadow-sm",
                badge === "A" ? "bg-orange-500" : "bg-rose-500",
              ].join(" ")}
            >
              {badge}
            </span>
          ))}
        </span>
      )}

      {showActions && onOpenInfo && (
        <button
          type="button"
          aria-label={`View details for ${course.code}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenInfo(course.code);
          }}
          className="absolute -right-2 -top-2 hidden h-6 w-6 shrink-0 place-items-center rounded-full border-slate-200 bg-surface p-0 text-slate-600 shadow-sm transition hover:border-blue-400 hover:text-blue-600 group-hover:grid pointer-coarse:grid dark:border-slate-600 dark:bg-input dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          <Info />
        </button>
      )}

      {showActions && onAdd && !course.isRoot && (
        <button
          type="button"
          aria-label={`Add ${course.code} to your selected courses`}
          title={`Add ${course.code} to your courses (or double click)`}
          onClick={(event) => {
            event.stopPropagation();
            onAdd(course.code);
          }}
          className="absolute -top-2 right-12 hidden h-6 w-6 shrink-0 place-items-center rounded-full border-slate-200 bg-surface p-0 text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-600 group-hover:grid pointer-coarse:grid dark:border-slate-600 dark:bg-input dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
        >
          <Plus />
        </button>
      )}

      {showActions && onHide && (
        <button
          type="button"
          aria-label={`Hide ${course.code} from the graph`}
          title={`Hide ${course.code} from the graph`}
          onClick={(event) => {
            event.stopPropagation();
            onHide(course.code);
          }}
          className="absolute -top-2 right-5 hidden h-6 w-6 shrink-0 place-items-center rounded-full border-slate-200 bg-surface p-0 text-slate-600 shadow-sm transition hover:border-rose-400 hover:text-rose-600 group-hover:grid pointer-coarse:grid dark:border-slate-600 dark:bg-input dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-400"
        >
          <EyeOff />
        </button>
      )}

      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {course.code}
      </div>
      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
        {course.name}
      </div>
      {course.isGhost &&
        (() => {
          const needs = [...(course.missingConditions ?? []), ...(course.missing ?? [])];
          if (needs.length === 0) return null;
          return (
            <div className="mt-1 text-[10px] text-purple-500 dark:text-purple-200">
              Needs {needs.slice(0, 2).join(", ")}
              {needs.length > 2 ? "…" : ""}
            </div>
          );
        })()}
    </div>
  );
}

export const CourseNode = memo(CourseNodeComponent);
