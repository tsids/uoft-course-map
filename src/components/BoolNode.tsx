import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type BoolNodeData = {
  operator: "and" | "or";
  highlighted?: boolean;
  selected?: boolean;
  visible?: boolean;
  inputs?: string[];
  unlocks?: string[];
};

const MAX_TOOLTIP_ITEMS = 6;

function BoolNodeComponent({ data }: NodeProps) {
  const { operator, highlighted, selected, inputs = [], unlocks = [] } = data as BoolNodeData;
  const shownInputs = inputs.slice(0, MAX_TOOLTIP_ITEMS);
  const hiddenInputCount = inputs.length - shownInputs.length;

  return (
    <div
      className={[
        "group relative flex h-8 w-12 cursor-pointer items-center justify-center rounded-full border-2 text-[11px] font-bold uppercase shadow-sm",
        selected
          ? "border-yellow-400 bg-surface text-yellow-700 ring-2 ring-yellow-300/50 dark:bg-white"
          : highlighted
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
        className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
      />
        <Handle
          type="target"
          position={Position.Right}
          id="right"
          style={{ top: "50%", right: -4, transform: "translateY(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
          className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
        />
      {operator}
      <Handle
        type="source"
        position={Position.Bottom}
          id="bottom"
          style={{ bottom: -4, left: "50%", transform: "translateX(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
          className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          style={{ top: "50%", left: -4, transform: "translateY(-50%)" }}
          isConnectable={false}
          isConnectableStart={false}
        className="pointer-events-none! h-px! w-px! border-0! bg-transparent! opacity-0!"
      />

      {(inputs.length > 0 || unlocks.length > 0) && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-surface px-3 py-2 text-left font-normal normal-case shadow-lg group-hover:block dark:border-slate-600 dark:bg-[#1f242d]">
          {inputs.length > 0 && (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {operator === "or" ? "Needs one of" : "Needs all of"}
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {shownInputs.map((input, index) => (
                  <li
                    key={`${index}-${input}`}
                    className="text-xs font-medium text-slate-700 dark:text-slate-200"
                  >
                    {input}
                  </li>
                ))}
              </ul>
              {hiddenInputCount > 0 && (
                <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  +{hiddenInputCount} more
                </div>
              )}
            </>
          )}
          {unlocks.length > 0 && (
            <div
              className={[
                "text-[11px] text-slate-500 dark:text-slate-400",
                inputs.length > 0 ? "mt-1.5 border-t border-slate-200 pt-1 dark:border-slate-700" : "",
              ].join(" ")}
            >
              Unlocks {unlocks.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const BoolNode = memo(BoolNodeComponent);
