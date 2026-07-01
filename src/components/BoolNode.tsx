import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type BoolNodeData = {
  operator: "and" | "or";
  highlighted?: boolean;
  visible?: boolean;
};

function BoolNodeComponent({ data }: NodeProps) {
  const { operator, highlighted } = data as BoolNodeData;

  return (
    <div
      className={[
        "flex h-8 w-12 items-center justify-center rounded-full border-2 text-[11px] font-bold uppercase shadow-sm",
        highlighted
          ? "border-emerald-500 bg-white text-emerald-700 ring-2 ring-emerald-400/40"
          : "border-slate-900 bg-white text-slate-900 dark:border-white dark:bg-white dark:text-slate-900",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
      {operator}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

export const BoolNode = memo(BoolNodeComponent);
