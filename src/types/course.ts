export type CourseDetail = {
  code: string;
  name: string;
  campus: string;
  facultyCode: string;
  description: string;
  note: string;
  prerequisitesText: string;
  corequisitesText: string;
  exclusionsText: string;
  recommendedPreparation: string;
  breadth: string[];
  distribution: string[];
};
