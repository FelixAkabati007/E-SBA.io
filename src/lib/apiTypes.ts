export type UploadAssessmentQuery = {
  subject: string;
  academicYear: string;
  term: string;
};

export type UploadAssessmentResponse = {
  ok: boolean;
  processed: number;
  errors?: string[];
};

export type SubjectSheetQuery = {
  subject: string;
  class: string;
  academicYear: string;
  term: string;
};

export type SubjectSheetRow = {
  student_id: string;
  surname: string;
  first_name: string;
  class_name: string;
  subject_name: string;
  cat1_score: number;
  cat2_score: number;
  cat3_score: number;
  cat4_score: number;
  group_work_score: number;
  project_work_score: number;
  exam_score: number;
  raw_sba_total: number;
};

export type SubjectSheetResponse = {
  rows: SubjectSheetRow[];
};

export type ApiError = { error: string };
