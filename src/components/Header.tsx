import { CheckCircle2, ExternalLink, Heart, Github, MessageSquareText, X } from "lucide-react";
import { memo, useMemo, useState, type ReactNode } from "react";

import { submitFeedback } from "../api/client";

type SupportPanel = "feedback" | null;

type HeaderProps = {
  activePanel: SupportPanel;
  onOpenFeedback: () => void;
  onClosePanel: () => void;
  repositoryUrl: string;
  kofiUrl: string;
  dataUpdatedAt?: string | null;
};

function buildIssueUrl(repositoryUrl: string, title: string, body: string) {
  const baseUrl = repositoryUrl.replace(/\/$/, "");
  return `${baseUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function SupportButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  const baseClasses =
    "inline-flex items-start justify-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium leading-none transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const toneClasses =
    "border-slate-200 bg-surface text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-input dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800";

  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${toneClasses}`}>
      {children}
    </button>
  );
}

function HeaderComponent({
  activePanel,
  onOpenFeedback,
  onClosePanel,
  repositoryUrl,
  kofiUrl,
  dataUpdatedAt,
}: HeaderProps) {
  const [topic, setTopic] = useState<"bug" | "suggestion">("bug");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentIssueUrl, setSentIssueUrl] = useState<string | null>(null);

  const issueUrl = useMemo(() => {
    const prefix = topic === "bug" ? "Bug report" : "Suggestion";
    const issueTitle = summary.trim() ? `${prefix}: ${summary.trim()}` : prefix;
    const issueBody = [
      `Type: ${topic === "bug" ? "Bug report" : "Suggestion"}`,
      "",
      details.trim() || "Describe what you saw or what you would like to change.",
    ].join("\n");

    return buildIssueUrl(repositoryUrl, issueTitle, issueBody);
  }, [details, repositoryUrl, summary, topic]);

  const resetForm = () => {
    setTopic("bug");
    setSummary("");
    setDetails("");
    setEmail("");
    setWebsite("");
    setStatus("idle");
    setSentIssueUrl(null);
  };

  const closePanel = () => {
    onClosePanel();
    if (status === "sent" || status === "error") {
      resetForm();
    }
  };

  const handleSubmit = async () => {
    if (status === "sending") return;
    if (!summary.trim() && !details.trim()) return;

    setStatus("sending");
    try {
      const result = await submitFeedback({
        topic,
        summary: summary.trim(),
        details: details.trim(),
        email: email.trim(),
        website,
      });
      setSentIssueUrl(result.issueUrl ?? null);
      setStatus("sent");
      setSummary("");
      setDetails("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const updatedLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const date = new Date(dataUpdatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [dataUpdatedAt]);

  return (
    <>
      <header className="w-full border-b border-slate-200/80 bg-surface/95 backdrop-blur dark:border-slate-700/80 dark:bg-header/95">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/course-tree.png"
              alt="UofT Course Map logo"
              className="h-7 w-7 shrink-0"
            />
            <p className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
              UofT Course Map
            </p>
            <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
              An interactive map of UofT courses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {updatedLabel && (
              <p className="hidden shrink-0 text-xs text-slate-400 dark:text-slate-500 md:block">
                Last updated {updatedLabel}
              </p>
            )}
            <SupportButton onClick={onOpenFeedback}>
              <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
              <span className="mb-1 hidden md:inline">Bugs/Suggestions</span>
            </SupportButton>
            <a
              href={kofiUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start justify-center gap-2 rounded-full border border-rose-200 bg-rose-500 px-3 py-1.5 text-xs font-medium leading-none text-white transition hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:border-rose-400/40 dark:bg-rose-500 dark:hover:bg-rose-400"
            >
              <Heart className="h-3.5 w-3.5 shrink-0" />
              <span className="mb-1 hidden md:inline">Leave a tip</span>
            </a>
            <a
              href={repositoryUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-surface p-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-input dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {activePanel && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/55 px-3 py-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-surface shadow-2xl dark:border-slate-700 dark:bg-modal">
            <div className="p-5 sm:p-6">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                      Feedback
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      Bug reports and suggestions
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                    aria-label="Close feedback form"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {status === "sent" ? (
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="grid gap-1 text-sm">
                        <p className="font-medium text-slate-900 dark:text-slate-50">
                          Thanks - your feedback has been submitted.
                        </p>
                        {sentIssueUrl && (
                          <a
                            href={sentIssueUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Track it on GitHub
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      >
                        Submit another
                      </button>
                      <button
                        type="button"
                        onClick={closePanel}
                        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                      >
                        Back to map
                      </button>
                    </div>
                  </div>
                ) : (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmit();
                  }}
                >
                  <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span>What kind of feedback is this?</span>
                    <select
                      value={topic}
                      onChange={(event) => setTopic(event.target.value as "bug" | "suggestion")}
                      className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-input dark:text-slate-50"
                    >
                      <option value="bug">Bug report</option>
                      <option value="suggestion">Suggestion</option>
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span>Summary</span>
                    <input
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder={topic === "bug" ? "What went wrong?" : "What should be improved?"}
                      className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-input dark:text-slate-50"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span>Details</span>
                    <textarea
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      rows={6}
                      placeholder="Add steps to reproduce, expected behavior, course codes, or anything else that helps."
                      className="rounded-2xl border border-slate-200 bg-surface px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-input dark:text-slate-50"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span>
                      Email <span className="text-slate-400 dark:text-slate-500">(optional)</span>
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Used to follow up"
                      className="rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-input dark:text-slate-50"
                    />
                  </label>

                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label>
                      Website
                      <input
                        type="text"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  {status === "error" && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                      Something went wrong submitting your feedback. Try again, or{" "}
                      <a
                        href={issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline"
                      >
                        open the issue on GitHub yourself
                      </a>
                      .
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Have a GitHub account?{" "}
                      <a
                        href={issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        File it yourself
                      </a>{" "}
                      to get notified of replies.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={closePanel}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={status === "sending" || (!summary.trim() && !details.trim())}
                        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MessageSquareText className="h-4 w-4" />
                        {status === "sending" ? "Submitting…" : "Submit feedback"}
                      </button>
                    </div>
                  </div>
                </form>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const Header = memo(HeaderComponent);
