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
          ? "border-emerald-500 bg-surface text-emerald-700 ring-[3px] ring-emerald-400/60"
          : "border-slate-900 bg-surface text-slate-900 dark:border-white dark:bg-white dark:text-slate-900",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Top}
          id="top"
          style={{ top: -4, left: "50%", transform: "translateX(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
        <Handle
          type="target"
          position={Position.Right}
          id="right"
          style={{ top: "50%", right: -4, transform: "translateY(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
          className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
        />
      {operator}
      <Handle
        type="source"
        position={Position.Bottom}
          id="bottom"
          style={{ bottom: -4, left: "50%", transform: "translateX(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
          className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          style={{ top: "50%", left: -4, transform: "translateY(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
        className="!pointer-events-none !h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

export const BoolNode = memo(BoolNodeComponent);
