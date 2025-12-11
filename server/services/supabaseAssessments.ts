import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase";

export type Row = {
  student_id: string;
  cat1: number;
  cat2: number;
  cat3: number;
  cat4: number;
  group: number;
  project: number;
  exam: number;
};

const clamp = (f: string, n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  if (f === "exam") return Math.max(0, Math.min(100, v));
  if (f === "group" || f === "project") return Math.max(0, Math.min(20, v));
  if (["cat1", "cat2", "cat3", "cat4"].includes(f))
    return Math.max(0, Math.min(10, v));
  return Math.max(0, v);
};

async function getSubjectId(subjectName: string): Promise<number> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("subject_id")
    .eq("subject_name", subjectName)
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { subject_id: number } | null)?.subject_id;
  if (!id) throw new Error("Subject not found");
  return id;
}

async function ensureSession(
  academicYear: string,
  term: string
): Promise<number> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const sel = await supabaseAdmin
    .from("academic_sessions")
    .select("session_id")
    .eq("academic_year", academicYear)
    .eq("term", term)
    .limit(1)
    .single();
  if (!sel.error && sel.data && (sel.data as { session_id: number }).session_id)
    return (sel.data as { session_id: number }).session_id;
  const up = await supabaseAdmin
    .from("academic_sessions")
    .upsert(
      [{ academic_year: academicYear, term, is_active: false }],
      { onConflict: "academic_year,term" }
    )
    .select("session_id")
    .single();
  if (up.error) throw new Error(up.error.message);
  const id = (up.data as { session_id: number } | null)?.session_id;
  if (!id) throw new Error("Failed to ensure session");
  return id;
}

export async function saveMarksSupabase(
  subjectName: string,
  academicYear: string,
  term: string,
  rows: Row[]
): Promise<void> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const subject_id = await getSubjectId(subjectName);
  const session_id = await ensureSession(academicYear, term);
  const payload = rows.map((r) => ({
    student_id: r.student_id,
    subject_id,
    session_id,
    cat1_score: clamp("cat1", r.cat1),
    cat2_score: clamp("cat2", r.cat2),
    cat3_score: clamp("cat3", r.cat3),
    cat4_score: clamp("cat4", r.cat4),
    group_work_score: clamp("group", r.group),
    project_work_score: clamp("project", r.project),
    exam_score: clamp("exam", r.exam),
  }));
  const { error } = await supabaseAdmin
    .from("assessments")
    .upsert(payload, { onConflict: "student_id,subject_id,session_id" });
  if (error) throw new Error(error.message);
}

export async function getSubjectSheetSupabase(
  className: string,
  subjectName: string,
  academicYear: string,
  term: string
): Promise<
  Array<{
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
  }>
> {
  if (!supabaseAdmin) throw new Error("Supabase not configured");
  const session_id = await ensureSession(academicYear, term);
  const resp: PostgrestSingleResponse<
    Array<{
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
    }>
  > = await supabaseAdmin.rpc("sp_get_subject_sheet", {
    p_class_name: className,
    p_subject_name: subjectName,
    p_session_id: session_id,
  });
  if (resp.error) throw new Error(resp.error.message);
  return (resp.data || []) as Array<{
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
  }>;
}

