import { ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";

type FceGpaPanelProps = {
  open: boolean;
  onToggle: () => void;
  fce: number;
  fceOverridden: boolean;
  gpa: number | null;
  onFceChange: (value: number | null) => void;
  onGpaChange: (value: number | null) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function NumberField({
  label,
  hint,
  value,
  placeholder,
  min,
  max,
  step,
  onCommit,
  action,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder?: string;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number | null) => void;
  action?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      onCommit(clamp(parsed, min, max));
    }
  };

  return (
    <label
      title={hint}
      className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200">
        {label}
        {action}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={draft ?? value}
        onFocus={() => setDraft(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          commit(event.target.value);
        }}
        onBlur={() => setDraft(null)}
        className="w-16 rounded-md border border-slate-200 bg-surface px-2 py-1 text-right text-sm text-slate-800 outline-none transition focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}

export function FceGpaPanel({
  open,
  onToggle,
  fce,
  fceOverridden,
  gpa,
  onFceChange,
  onGpaChange,
}: FceGpaPanelProps) {
  return (
    <div className="pointer-events-auto w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-surface/95 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-[#252a33]/95">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Your standing
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {!open && (
            <span>
              FCE {fce}
              {gpa !== null && ` · GPA ${gpa}`}
            </span>
          )}
          <ChevronDown
            className={[
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-0.5 px-2 pb-2.5">
          <NumberField
            label="FCE count"
            hint={
              fceOverridden
                ? "Manually set; used for FCE requirements."
                : "Auto-counted from selected courses; edit to override."
            }
            value={String(fce)}
            min={0}
            max={60}
            step={0.5}
            onCommit={onFceChange}
            action={
              fceOverridden && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    onFceChange(null);
                  }}
                  title="Reset to auto count"
                  aria-label="Reset FCE count to auto"
                  className="text-slate-400 transition hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )
            }
          />
          <NumberField
            label="GPA"
            hint="Optional; leave blank to ignore GPA cutoffs."
            value={gpa === null ? "" : String(gpa)}
            placeholder="–"
            min={0}
            max={4}
            step={0.1}
            onCommit={onGpaChange}
          />
          <p className="px-1 pt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
            {fceOverridden
              ? "FCE set manually."
              : "FCE auto-counts selected courses."}{" "}
            Blank GPA is ignored.
          </p>
        </div>
      )}
    </div>
  );
}
