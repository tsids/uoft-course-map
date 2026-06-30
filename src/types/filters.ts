export type Campus = "St. George" | "UTM" | "UTSC";

export type FilterState = {
  search: string;
  campus: Campus | "";
  department: string;
  faculty: string;
  year: string;
  breadth: string;
  distribution: string;
  session: string;
};

export type SettingsState = {
  showNoPrerequisites: boolean;
  engineeringStudent: boolean;
  showPostrequisites: boolean;
  showCorequisites: boolean;
  showExclusions: boolean;
  highlightPath: boolean;
};

export const defaultFilters: FilterState = {
  search: "",
  campus: "",
  department: "",
  faculty: "",
  year: "",
  breadth: "",
  distribution: "",
  session: "",
};

export const defaultSettings: SettingsState = {
  showNoPrerequisites: false,
  engineeringStudent: false,
  showPostrequisites: true,
  showCorequisites: false,
  showExclusions: false,
  highlightPath: true,
};

export const CAMPUSES: Campus[] = ["St. George", "UTM", "UTSC"];

export const DEPARTMENTS = [
  "Computer Science",
  "Mathematics",
  "Statistics",
  "Electrical & Computer Engineering",
  "Mechanical & Industrial Engineering",
];

export const FACULTIES = [
  "Faculty of Arts and Science",
  "Faculty of Applied Science & Engineering",
  "John H. Daniels Faculty of Architecture, Landscape, and Design",
];

export const YEARS = ["1", "2", "3", "4"];

export const BREADTHS = [
  "Creative and Cultural Representations (1)",
  "Thought, Belief and Behaviour (2)",
  "Society and its Institutions (3)",
  "Living Things and Their Environment (4)",
  "The Physical and Mathematical Universes (5)",
];

export const DISTRIBUTIONS = ["Humanities", "Social Science", "Science"];

export const SESSIONS = ["Fall", "Winter", "Summer"];
