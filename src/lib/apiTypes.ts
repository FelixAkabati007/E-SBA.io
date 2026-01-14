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

export type AssessmentMarkRow = {
  student_id: string;
  cat1?: number;
  cat1_score?: number;
  cat2?: number;
  cat2_score?: number;
  cat3?: number;
  cat3_score?: number;
  cat4?: number;
  cat4_score?: number;
  group?: number;
  group_work_score?: number;
  project?: number;
  project_work_score?: number;
  exam?: number;
  exam_score?: number;
};

export type ApiError = { error: string };

export interface RankingRow {
  student_id: string;
  position: number;
  surname: string;
  first_name: string;
  middle_name: string;
  class_name: string;
  overall_score: number;
}

export interface RankingData {
  data: RankingRow[];
  total: number;
}

export type Gender = "Male" | "Female" | "Other";

export interface Student {
  id: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: Gender;
  dob: string;
  guardianContact: string;
  class: string;
  status: "Active" | "Withdrawn" | "Inactive";
}

export interface Marks {
  [studentId: string]: {
    [subject: string]: {
      cat1: number;
      cat2: number;
      cat3: number;
      cat4: number;
      group: number;
      project: number;
      exam: number;
    };
  };
}

export interface GradeConfig {
  min: number;
  max: number;
  grade: number;
  remark: string;
  desc: string;
}
