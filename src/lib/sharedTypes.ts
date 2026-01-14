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
