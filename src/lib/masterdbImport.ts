export type Gender = "Male" | "Female" | "Other";

export type Student = {
  id: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: Gender;
  class: string;
  status: "Active" | "Withdrawn" | "Inactive";
  dob: string;
  guardianContact: string;
};

type Row = Record<string, unknown>;

export function buildImportedStudents(
  importedPreview: Row[],
  existingStudents: Student[],
  selectedClass: string,
  academicYear: string
): { newStudents: Student[]; addedCount: number; skippedCount: number } {
  let addedCount = 0;
  let skippedCount = 0;
  const newStudents: Student[] = [];
  const yearSuffix = academicYear.substring(2, 4);
  let currentSeq = existingStudents.length + 1;
  importedPreview.forEach((row) => {
    let newId = (row["id"] as string) || (row["student id"] as string);
    if (!newId) {
      newId = `JHS${yearSuffix}${currentSeq.toString().padStart(3, "0")}`;
      currentSeq++;
    }
    if (
      existingStudents.some((s) => s.id === newId) ||
      newStudents.some((s) => s.id === newId)
    ) {
      skippedCount++;
      return;
    }
    let genderVal: Gender = "Male";
    const rawGender = String(row["gender"] || "").toLowerCase();
    if (rawGender.startsWith("f")) genderVal = "Female";
    else if (rawGender.startsWith("m")) genderVal = "Male";
    else if (rawGender) genderVal = "Other";
    const student: Student = {
      id: String(newId),
      surname: String(
        row["surname"] || row["lastname"] || row["last name"] || ""
      ).toUpperCase(),
      firstName: String(row["firstname"] || row["first name"] || ""),
      middleName: String(
        row["middlename"] || row["middle name"] || row["othernames"] || ""
      ),
      gender: genderVal,
      class: String(row["class"] || selectedClass),
      status: "Active",
      dob: String(row["dob"] || row["date of birth"] || "2000-01-01"),
      guardianContact: String(
        row["contact"] || row["guardian contact"] || row["phone"] || ""
      ),
    };
    if (student.surname && student.firstName) {
      newStudents.push(student);
      addedCount++;
    } else {
      skippedCount++;
    }
  });
  return { newStudents, addedCount, skippedCount };
}
