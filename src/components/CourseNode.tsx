import { Info } from "lucide-react";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "../types/graph";

export type CourseNodeData = {
  course: GraphNode;
  selected?: boolean;
  highlighted?: boolean;
  hovered?: boolean;
  dimmed?: boolean;
  showNoPrerequisites?: boolean;
  visible?: boolean;
  onOpenInfo?: (code: string) => void;
};

function CourseNodeComponent({ data }: NodeProps) {
  const { course, selected, highlighted, hovered, dimmed, showNoPrerequisites, onOpenInfo } =
    data as CourseNodeData;

  // Prerequisites of unlocked courses that are needed to complete the chain but
  // aren't themselves selected/unlocked. Shown with a distinct "required" color.
  const isRequiredPrerequisite =
    !course.isRoot &&
    !course.isGhost &&
    (course.roles?.includes("requiredPrerequisite") ?? false) &&
    !(course.roles?.includes("postrequisite") ?? false);

  return (
    <div
      className={[
        "group relative w-[180px] rounded-lg border px-3 py-2 text-left shadow-sm transition",
        course.isGhost
          ? "border-dashed border-violet-400/70 bg-violet-50/40 opacity-80 dark:border-violet-400/50 dark:bg-violet-500/5"
          : isRequiredPrerequisite
            ? "bg-amber-50 dark:bg-amber-500/10"
            : "bg-white dark:bg-[#252a33]",
        !course.isGhost && course.isRoot
          ? "border-blue-500 ring-2 ring-blue-400/40"
          : !course.isGhost && selected
            ? "border-blue-500 ring-2 ring-blue-400/40"
            : !course.isGhost && highlighted
              ? "border-emerald-400 ring-2 ring-emerald-400/50"
              : !course.isGhost && isRequiredPrerequisite
                ? "border-amber-400 dark:border-amber-500/60"
                : !course.isGhost
                  ? "border-slate-200 dark:border-slate-700"
                  : "",
        !course.hasPrerequisites && showNoPrerequisites
          ? "outline outline-2 outline-amber-400/70"
          : "",
        dimmed ? "opacity-35" : "opacity-100",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />

      {hovered && onOpenInfo && (
        <button
          type="button"
          aria-label={`View details for ${course.code}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenInfo(course.code);
          }}
          className="absolute -right-2 -top-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border-slate-200 bg-white p-0 text-slate-600 shadow-sm transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          <Info />
        </button>
      )}

      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{course.code}</div>
      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
        {course.name}
      </div>
      {course.isGhost && course.missing && course.missing.length > 0 && (
        <div className="mt-1 text-[10px] text-violet-600 dark:text-violet-300">
          Needs {course.missing.slice(0, 2).join(", ")}
          {course.missing.length > 2 ? "…" : ""}
        </div>
      )}
    </div>
  );
}

export const CourseNode = memo(CourseNodeComponent);
