import { supabase } from "./supabase";
import { apiClient } from "./apiClient";
import { logger } from "./logger";
import type { SubjectSheetQuery, SubjectSheetRow } from "./apiTypes";

const key = (q: SubjectSheetQuery): string =>
  `marks:${q.class}:${q.subject}:${q.academicYear}:${q.term}`;

export function saveMarksSession(
  q: SubjectSheetQuery,
  rows: SubjectSheetRow[]
): void {
  try {
    const payload = { rows, savedAt: Date.now() };
    sessionStorage.setItem(key(q), JSON.stringify(payload));
    logger.info("marks_session_saved", { count: rows.length });
  } catch (e) {
    logger.warn("marks_session_save_failed", e);
  }
}

export function loadMarksSession(
  q: SubjectSheetQuery
): { rows: SubjectSheetRow[]; savedAt: number } | null {
  try {
    const raw = sessionStorage.getItem(key(q));
    if (!raw) return null;
    const json = JSON.parse(raw) as {
      rows?: SubjectSheetRow[];
      savedAt?: number;
    };
    const rows = Array.isArray(json.rows) ? json.rows : [];
    const savedAt = Number(json.savedAt || 0);
    return rows.length ? { rows, savedAt } : null;
  } catch (e) {
    logger.warn("marks_session_load_failed", e);
    return null;
  }
}

export function subscribeAssessments(
  q: SubjectSheetQuery,
  onRefresh: (rows: SubjectSheetRow[]) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(
      `assessments-${q.class}-${q.subject}-${q.academicYear}-${q.term}`
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "assessments" },
      async () => {
        try {
          const data = await apiClient.getSubjectSheet(q);
          const rows = Array.isArray(data.rows) ? data.rows : [];
          saveMarksSession(q, rows);
          onRefresh(rows);
          logger.info("realtime_marks_refreshed", { count: rows.length });
        } catch (e) {
          logger.warn("realtime_marks_refresh_failed", e);
        }
      }
    )
    .subscribe();
  return () => {
    try {
      channel.unsubscribe();
    } catch (_e) {
      void _e;
    }
  };
}
