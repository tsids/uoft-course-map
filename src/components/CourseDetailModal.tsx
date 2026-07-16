import { ExternalLink, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { CourseDetail } from "../types/course";

type CourseDetailModalProps = {
  course: CourseDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLeadingLabel(value: string, labels: string[]): string {
  for (const label of labels) {
    const pattern = new RegExp(`^${label}:?\\s*`, "i");
    if (pattern.test(value)) {
      return value.replace(pattern, "").trim();
    }
  }
  return value;
}

type DetailField = {
  label: string;
  value: string;
};

const FACULTY_CALENDAR_HOSTS: Record<string, string> = {
  ARTSC: "artsci.calendar.utoronto.ca",
  APSC: "engineering.calendar.utoronto.ca",
  FIS: "ischool.calendar.utoronto.ca",
  FPEH: "kpe.calendar.utoronto.ca",
  MUSIC: "music.calendar.utoronto.ca",
  ARCLA: "daniels.calendar.utoronto.ca",
  ERIN: "utm.calendar.utoronto.ca",
  SCAR: "utsc.calendar.utoronto.ca",
};

const CAMPUS_CALENDAR_HOSTS: Record<string, string> = {
  "St. George": "artsci.calendar.utoronto.ca",
  "Scarborough": "utsc.calendar.utoronto.ca",
  "University of Toronto at Mississauga": "utm.calendar.utoronto.ca",
};

function calendarUrl(course: CourseDetail): string | null {
  const host = FACULTY_CALENDAR_HOSTS[course.facultyCode] ?? CAMPUS_CALENDAR_HOSTS[course.campus];
  return host ? `https://${host}/course/${course.code}` : null;
}

function buildFields(course: CourseDetail): DetailField[] {
  const fields: DetailField[] = [];

  const description = stripHtml(course.description);
  if (description) {
    fields.push({ label: "", value: description });
  }

  const prerequisites = stripLeadingLabel(stripHtml(course.prerequisitesText), [
    "Prerequisites",
    "Prerequisite",
  ]);
  if (prerequisites) {
    fields.push({ label: "Prerequisites", value: prerequisites });
  }

  const corequisites = stripLeadingLabel(stripHtml(course.corequisitesText), [
    "Corequisites",
    "Corequisite",
  ]);
  if (corequisites) {
    fields.push({ label: "Corequisites", value: corequisites });
  }

  const exclusions = stripLeadingLabel(stripHtml(course.exclusionsText), ["Exclusions", "Exclusion"]);
  if (exclusions) {
    fields.push({ label: "Exclusions", value: exclusions });
  }

  const recommended = stripLeadingLabel(stripHtml(course.recommendedPreparation), [
    "Recommended Preparation",
  ]);
  if (recommended) {
    fields.push({ label: "Recommended Preparation", value: recommended });
  }

  if (course.distribution.length > 0) {
    fields.push({
      label: "Distribution Requirement",
      value: course.distribution.join(", "),
    });
  }

  if (course.breadth.length > 0) {
    fields.push({
      label: "Breadth Requirements",
      value: course.breadth.join(", "),
    });
  }

  const note = stripHtml(course.note);
  if (note) {
    fields.push({ label: "Note", value: note });
  }

  return fields;
}

export function CourseDetailModal({ course, loading, error, onClose }: CourseDetailModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fields = useMemo(() => (course ? buildFields(course) : []), [course]);
  const calendarLink = course ? calendarUrl(course) : null;

  if (!course && !loading && !error) return null;

  return (
    <div
      data-modal-overlay
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-detail-title"
        className="flex max-h-[min(85vh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-2xl dark:border-slate-700 dark:bg-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0 pr-2">
            {loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading course details...</p>
            )}
            {!loading && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!loading && course && (
              <h2
                id="course-detail-title"
                className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100"
              >
                {course.code}: {course.name}
                {calendarLink && (
                  <a
                    href={calendarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${course.code} in the official calendar`}
                    title="View in the official calendar"
                    className="ml-2 inline-block align-[-2px] text-slate-400 transition hover:text-blue-500 dark:text-slate-500 dark:hover:text-blue-400"
                  >
                    <ExternalLink className="h-4.5 w-4.5" />
                  </a>
                )}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="shrink-0 cursor-default rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!loading && course && (
          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
            {fields.map((field, index) =>
              field.label === "" ? (
                <p key={`desc-${index}`} className="whitespace-pre-wrap">
                  {field.value}
                </p>
              ) : (
                <p key={`${field.label}-${index}`}>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {field.label}:
                  </span>{" "}
                  {field.value}
                </p>
              ),
            )}

            {fields.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400">No course details available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
