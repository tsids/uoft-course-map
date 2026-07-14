import { ChevronDown, ChevronUp } from "lucide-react";
import type { GraphEdge } from "../types/graph";

type GraphLegendProps = {
  open: boolean;
  onToggle: () => void;
  theme: "light" | "dark";
  compareActive?: boolean;
  hiddenEdgeKinds: GraphEdge["kind"][];
  onToggleEdgeKind: (kind: GraphEdge["kind"]) => void;
};

function LegendSwatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-10 shrink-0 items-center justify-center">{children}</div>
      <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
    </div>
  );
}

function EdgeToggle({
  label,
  color,
  dashed,
  hidden,
  onToggle,
}: {
  label: string;
  color: string;
  dashed?: boolean;
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!hidden}
      title={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
      className={[
        "-mx-1 flex items-center gap-2.5 rounded-md px-1 py-0.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700/50",
        hidden ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="flex h-7 w-10 shrink-0 items-center justify-center">
        <svg width="36" height="10" aria-hidden="true">
          <line
            x1="2"
            y1="5"
            x2="30"
            y2="5"
            stroke={color}
            strokeWidth="2"
            strokeDasharray={dashed ? "5 3" : undefined}
          />
          <polygon points="30,5 24,2 24,8" fill={color} />
        </svg>
      </div>
      <span
        className={[
          "text-xs text-slate-600 dark:text-slate-300",
          hidden ? "line-through" : "",
        ].join(" ")}
      >
        {label}
      </span>
    </button>
  );
}

export function GraphLegend({
  open,
  onToggle,
  theme,
  compareActive = false,
  hiddenEdgeKinds,
  onToggleEdgeKind,
}: GraphLegendProps) {
  const dark = theme === "dark";
  const isHidden = (kind: GraphEdge["kind"]) => hiddenEdgeKinds.includes(kind);

  return (
    <div
      className={[
        "pointer-events-auto rounded-xl border border-slate-200/80 bg-surface/95 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-panel/95",
        open ? "w-[min(14rem,calc(100vw-2rem))]" : "w-auto",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Collapse legend" : "Expand legend"}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Legend
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-200/70 p-3 pt-2 dark:border-slate-700/70">
          {compareActive && (
            <>
              <LegendSwatch label="Unlocked by group A only">
                <div className="relative h-5 w-9 rounded border border-orange-400 bg-surface dark:border-orange-500/70 dark:bg-panel">
                  <span className="absolute -left-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-orange-500 text-[8px] font-bold text-white">
                    A
                  </span>
                </div>
              </LegendSwatch>

              <LegendSwatch label="Unlocked by group B only">
                <div className="relative h-5 w-9 rounded border border-rose-400 bg-surface dark:border-rose-500/70 dark:bg-panel">
                  <span className="absolute -left-1.5 -top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                    B
                  </span>
                </div>
              </LegendSwatch>

              <LegendSwatch label="Unlocked by both groups">
                <div className="relative h-5 w-9 rounded border border-slate-200 bg-surface dark:border-slate-700 dark:bg-panel">
                  <span className="absolute -left-1.5 -top-1.5 flex gap-px">
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-orange-500 text-[8px] font-bold text-white">
                      A
                    </span>
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                      B
                    </span>
                  </span>
                </div>
              </LegendSwatch>
            </>
          )}

          <LegendSwatch label="Selected course">
            <div className="h-5 w-9 rounded border-2 border-blue-500 bg-surface ring-2 ring-blue-400/40 dark:bg-panel" />
          </LegendSwatch>

          <LegendSwatch label="Clicked course (path highlighted)">
            <div className="h-5 w-9 rounded border-2 border-yellow-500 bg-surface ring-2 ring-yellow-400/60 dark:border-yellow-300 dark:ring-yellow-300/50 dark:bg-panel" />
          </LegendSwatch>

          <LegendSwatch label="Postrequisites">
            <div className="h-5 w-9 rounded border border-purple-300 bg-postreq dark:border-purple-400/45 dark:bg-postreq-dark" />
          </LegendSwatch>

          <div className="mt-1 flex flex-col gap-1 border-t border-slate-200/70 pt-2 dark:border-slate-700/70">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Relationships - tap to show/hide
            </span>
            <EdgeToggle
              label="Prerequisites"
              color={dark ? "var(--color-edge-prereq-dark)" : "var(--color-edge-prereq)"}
              hidden={isHidden("prerequisite")}
              onToggle={() => onToggleEdgeKind("prerequisite")}
            />
            <EdgeToggle
              label="Corequisites"
              color={dark ? "var(--color-edge-coreq-dark)" : "var(--color-edge-coreq)"}
              dashed
              hidden={isHidden("corequisite")}
              onToggle={() => onToggleEdgeKind("corequisite")}
            />
            <EdgeToggle
              label="Exclusions"
              color={dark ? "var(--color-edge-exclusion-dark)" : "var(--color-edge-exclusion)"}
              dashed
              hidden={isHidden("exclusion")}
              onToggle={() => onToggleEdgeKind("exclusion")}
            />
          </div>

          <div className="mt-1 flex flex-col gap-1 border-t border-slate-200/70 pt-2 text-xs text-slate-600 dark:border-slate-700/70 dark:text-slate-300">
            <span>
              <span className="font-medium">Click</span> - highlight path
            </span>
            <span>
              <span className="font-medium">Double click</span> - add course
            </span>
            <span>
              <span className="font-medium">Hover</span> - preview connections
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
