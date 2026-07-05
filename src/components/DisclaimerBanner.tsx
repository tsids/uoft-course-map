import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useState } from "react";

import { DISCLAIMER_TTL_MS, STORAGE_KEYS } from "../types/filters";

function isDismissalActive(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.disclaimerDismissed);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "savedAt" in parsed &&
      typeof (parsed as { savedAt: unknown }).savedAt === "number" &&
      Date.now() - (parsed as { savedAt: number }).savedAt <= DISCLAIMER_TTL_MS
    ) {
      return true;
    }
    localStorage.removeItem(STORAGE_KEYS.disclaimerDismissed);
    return false;
  } catch {
    return false;
  }
}

export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(isDismissalActive);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const dismiss = () => {
    setDismissed(true);
    if (dontShowAgain) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.disclaimerDismissed,
          JSON.stringify({ savedAt: Date.now() }),
        );
      } catch {
        // ignore write failures (e.g. storage disabled)
      }
    }
  };

  if (dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="pointer-events-auto flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-amber-200 bg-surface/95 p-4 shadow-lg backdrop-blur dark:border-amber-500/30 dark:bg-[#1b2028]/95">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Always make sure to double check prerequisites and course details with the official UofT
            Timetable at{" "}
            <a
              href="https://ttb.utoronto.ca"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              ttb.utoronto.ca
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            .
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Don&apos;t show this again
          </label>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss disclaimer"
          className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
