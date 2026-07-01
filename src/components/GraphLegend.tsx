type GraphLegendProps = {
  theme: "light" | "dark";
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

function LegendLine({
  label,
  color,
  dashed,
  arrow,
}: {
  label: string;
  color: string;
  dashed?: boolean;
  arrow?: boolean;
}) {
  return (
    <LegendSwatch label={label}>
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
        {arrow && <polygon points="30,5 24,2 24,8" fill={color} />}
      </svg>
    </LegendSwatch>
  );
}

export function GraphLegend({ theme }: GraphLegendProps) {
  const dark = theme === "dark";

  return (
    <div className="pointer-events-auto w-[min(14rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-[#252a33]/95">
      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Legend
      </h2>

      <div className="flex flex-col gap-2">
        <LegendSwatch label="Selected course">
          <div className="h-5 w-9 rounded border-2 border-blue-500 bg-white ring-2 ring-blue-400/40 dark:bg-[#252a33]" />
        </LegendSwatch>

        <LegendSwatch label="Unlocked postrequisite">
          <div className="h-5 w-9 rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#252a33]" />
        </LegendSwatch>

        <LegendSwatch label="Close match (needs more courses)">
          <div className="h-5 w-9 rounded border border-dashed border-violet-400/70 bg-violet-50/40 opacity-80 dark:border-violet-400/50 dark:bg-violet-500/5" />
        </LegendSwatch>

        <LegendSwatch label="Required prerequisite (needed, not selected)">
          <div className="h-5 w-9 rounded border border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10" />
        </LegendSwatch>

        <LegendLine
          label="Postrequisites"
          color={dark ? "#a78bfa" : "#7c3aed"}
          arrow
        />
        <LegendLine
          label="Corequisites"
          color={dark ? "#60a5fa" : "#2563eb"}
          dashed
        />
        <LegendLine
          label="Exclusions"
          color={dark ? "#f87171" : "#dc2626"}
          dashed
          arrow
        />
      </div>
    </div>
  );
}
