import { Moon, Settings, Sun } from "lucide-react";
import { MAX_COURSES_OPTIONS, type SettingsState } from "../types/filters";

type SettingsPanelProps = {
  open: boolean;
  onToggle: () => void;
  settings: SettingsState;
  theme: "light" | "dark";
  onSettingsChange: (patch: Partial<SettingsState>) => void;
  onToggleTheme: () => void;
};

function SettingCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="flex flex-col">
        <span className="text-sm text-slate-800 dark:text-slate-100">{label}</span>
        {description && (
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:block">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function SettingsPanel({
  open,
  onToggle,
  settings,
  theme,
  onSettingsChange,
  onToggleTheme,
}: SettingsPanelProps) {
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close settings" : "Open settings"}
        aria-expanded={open}
        className={[
          "flex h-9 w-9 items-center justify-center rounded-lg border shadow-sm backdrop-blur transition",
          "bg-surface/95 text-slate-600 hover:border-blue-400 hover:text-blue-600",
          "dark:bg-[#252a33]/95 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400",
          open
            ? "border-blue-400 text-blue-600 dark:border-blue-500 dark:text-blue-400"
            : "border-slate-200/80 dark:border-slate-700/80",
        ].join(" ")}
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200/80 bg-surface/95 p-3 shadow-lg backdrop-blur dark:border-slate-700/80 dark:bg-[#252a33]/95">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-14 items-center rounded-full border border-slate-200 bg-slate-100 p-1 transition dark:border-slate-600 dark:bg-slate-800"
            >
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full bg-surface text-amber-500 shadow transition dark:bg-slate-700 dark:text-blue-300",
                  theme === "dark" ? "translate-x-6" : "translate-x-0",
                ].join(" ")}
              >
                {theme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            <SettingCheckbox
              label="Highlight courses with no prerequisites"
              description="Highlight entry-level courses."
              checked={settings.showNoPrerequisites}
              onChange={(showNoPrerequisites) => onSettingsChange({ showNoPrerequisites })}
            />
            <SettingCheckbox
              label="Recursive postrequisites"
              description="Keep expanding: courses unlocked by your postrequisites, and so on."
              checked={settings.recursivePostrequisites}
              onChange={(recursivePostrequisites) => onSettingsChange({ recursivePostrequisites })}
            />
            {/* <SettingCheckbox
              label="Engineering student"
              checked={settings.engineeringStudent}
              onChange={(engineeringStudent) => onSettingsChange({ engineeringStudent })}
            /> */}
            <label className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <span className="flex flex-col">
                <span className="text-sm text-slate-800 dark:text-slate-100">Max courses shown</span>
                <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:block">
                  Lower this if the graph runs slowly.
                </span>
              </span>
              <select
                value={settings.maxCourses}
                onChange={(event) => onSettingsChange({ maxCourses: Number(event.target.value) })}
                className="rounded-md border border-slate-200 bg-surface px-2 py-1 text-sm text-slate-800 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-[#1f242d] dark:text-slate-100"
              >
                {MAX_COURSES_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
