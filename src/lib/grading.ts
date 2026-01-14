export interface GradeConfig {
  min: number;
  max: number;
  grade: number;
  remark: string;
  desc: string;
}

export const GRADING_SYSTEM: GradeConfig[] = [
  { min: 80, max: 100, grade: 1, remark: "Highest", desc: "Distinction" },
  { min: 70, max: 79, grade: 2, remark: "High", desc: "Very Good" },
  { min: 60, max: 69, grade: 3, remark: "High Average", desc: "Good" },
  { min: 55, max: 59, grade: 4, remark: "Average", desc: "Credit" },
  { min: 50, max: 54, grade: 5, remark: "Low Average", desc: "Pass" },
  { min: 45, max: 49, grade: 6, remark: "Low", desc: "Weak" },
  { min: 40, max: 44, grade: 7, remark: "Lower", desc: "Very Weak" },
  { min: 35, max: 39, grade: 8, remark: "Lowest", desc: "Fail" },
  { min: 0, max: 34, grade: 9, remark: "Fail", desc: "Fail" },
];

export const calculateGrade = (score: number) => {
  const found = GRADING_SYSTEM.find((s) => score >= s.min && score <= s.max);
  return found
    ? { grade: found.grade, remark: found.remark, desc: found.desc }
    : { grade: 9, remark: "Fail", desc: "Fail" };
};

export const getOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"] as const;
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
