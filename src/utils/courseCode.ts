/** UofT catalogue course codes as stored in the database (UTSG + UTSC/UTM). */
export const COURSE_CODE_PATTERN = /^(?:[A-Z]{3}\d{3}[HY]\d|[A-Z]{4}\d{2}[HY]\d)$/i;

export function isValidCourseCodeFormat(code: string): boolean {
  return COURSE_CODE_PATTERN.test(code.trim());
}

export function parseCommaSeparatedCourses(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hasMultipleCourseCodes(input: string): boolean {
  return input.includes(",");
}

export function courseWeight(code: string): number {
  const trimmed = code.trim().toUpperCase();
  if (!COURSE_CODE_PATTERN.test(trimmed)) return 0.5;
  return trimmed[trimmed.length - 2] === "Y" ? 1 : 0.5;
}

export function totalFce(codes: string[]): number {
  return codes.reduce((sum, code) => sum + courseWeight(code), 0);
}
