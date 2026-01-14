import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "../lib/apiClient";
import { Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AttendanceRegisterProps {
  className: string;
  academicYear: string;
  term: string;
}

interface AttendanceRow {
  student_id: string;
  surname: string;
  first_name: string;
  status: string | null;
  arrival_time: string | null;
  last_modified_at: string | null;
  pending?: boolean;
}

export const AttendanceRegister: React.FC<AttendanceRegisterProps> = ({
  className,
  academicYear,
  term,
}) => {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEditRegister =
    !!user &&
    (user.role === "HEAD" ||
      (user.role === "CLASS" && user.assignedClassName === className));

  const summary = useMemo(() => {
    const base = {
      Present: 0,
      Late: 0,
      Absent: 0,
      Excused: 0,
    } as Record<string, number>;
    for (const s of students) {
      if (s.status && base[s.status] !== undefined) {
        base[s.status] += 1;
      }
    }
    return base;
  }, [students]);

  useEffect(() => {
    if (className) {
      void loadAttendance();
    }
  }, [className, date]);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getDailyClassAttendance(className, date);
      setStudents(res.data || []);
    } catch (e) {
      setError("Failed to load attendance data");
      console.error(e);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const parseTimeToMinutes = (time: string | null) => {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length < 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const deriveStatusFromTime = (
    time: string | null
  ): "Present" | "Late" | "Absent" | null => {
    const mins = parseTimeToMinutes(time);
    if (mins === null) return null;
    const eight = 8 * 60;
    const twelve = 12 * 60;
    if (mins <= eight) return "Present";
    if (mins > eight && mins <= twelve) return "Late";
    return "Absent";
  };

  const handleStatusChange = async (studentId: string, nextStatus: string) => {
    if (!canEditRegister) return;
    const currentRow = students.find((s) => s.student_id === studentId);
    if (!currentRow) return;

    let reason: string | undefined;
    const mins = parseTimeToMinutes(currentRow.arrival_time);
    const twelve = 12 * 60;
    if (
      mins !== null &&
      mins > twelve &&
      currentRow.status === "Absent" &&
      nextStatus !== "Absent"
    ) {
      const input = window.prompt(
        "Provide a reason to override Absent after 12:00 PM:"
      );
      if (!input) {
        return;
      }
      reason = input;
    }

    const previous = students;
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? { ...s, status: nextStatus, pending: true }
          : s
      )
    );

    try {
      await apiClient.markDailyAttendance({
        studentId,
        date,
        status: nextStatus,
        time: currentRow.arrival_time || undefined,
        academicYear,
        term,
        reason,
      });

      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId
            ? {
                ...s,
                pending: false,
                last_modified_at: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (e) {
      console.error("Failed to mark attendance", e);
      setError("Failed to update attendance. Please try again.");
      setStudents(previous);
    }
  };

  const handleTimeChange = async (studentId: string, time: string) => {
    if (!canEditRegister) return;
    const currentRow = students.find((s) => s.student_id === studentId);
    if (!currentRow) return;

    const derived = time ? deriveStatusFromTime(time) : null;
    const nextStatus = derived || currentRow.status || "Present";

    const previous = students;
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              arrival_time: time || null,
              status: nextStatus,
              pending: true,
            }
          : s
      )
    );

    try {
      await apiClient.markDailyAttendance({
        studentId,
        date,
        time: time || undefined,
        status: nextStatus,
        academicYear,
        term,
      });
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId
            ? {
                ...s,
                pending: false,
                last_modified_at: new Date().toISOString(),
              }
            : s
        )
      );
    } catch (e) {
      console.error("Failed to save time", e);
      setError("Failed to save arrival time. Please try again.");
      setStudents(previous);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Daily Register: {className}
        </h2>
        <div className="flex items-center gap-4">
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => void loadAttendance()}
            className="text-blue-600 text-sm hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 text-xs text-slate-600">
        <div>
          <span className="font-semibold">Rules:</span> Arrival ≤ 8:00 →
          Present; 8:01–12:00 → Late; after 12:00 → Absent.
        </div>
        <div className="flex gap-3">
          <span>Present: {summary.Present}</span>
          <span>Late: {summary.Late}</span>
          <span>Absent: {summary.Absent}</span>
          <span>Excused: {summary.Excused}</span>
        </div>
      </div>

      {!canEditRegister && (
        <div className="bg-yellow-50 text-yellow-700 p-3 rounded mb-4 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          You have view-only access to this register. Only Class Teachers and
          Head can edit.
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500">
          Loading register...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Arrival Time</th>
                <th className="px-4 py-3 text-center">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.student_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {student.student_id}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {student.surname}, {student.first_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      {["Present", "Late", "Absent", "Excused"].map(
                        (status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={!canEditRegister}
                            onClick={() =>
                              handleStatusChange(student.student_id, status)
                            }
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                              student.status === status
                                ? getStatusColor(status)
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            } ${
                              !canEditRegister
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {status}
                          </button>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="time"
                      aria-label="Arrival Time"
                      value={student.arrival_time?.slice(0, 5) || ""}
                      onChange={(e) =>
                        handleTimeChange(student.student_id, e.target.value)
                      }
                      disabled={!canEditRegister}
                      className={`border rounded px-2 py-1 text-center w-24 ${
                        !canEditRegister
                          ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                          : ""
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {student.pending && (
                      <span className="text-xs text-amber-500 animate-pulse">
                        Saving...
                      </span>
                    )}
                    {!student.pending && student.last_modified_at && (
                      <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    No students found in {className}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function getStatusColor(status: string) {
  switch (status) {
    case "Present":
      return "bg-green-100 text-green-700 ring-1 ring-green-600";
    case "Late":
      return "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-600";
    case "Absent":
      return "bg-red-100 text-red-700 ring-1 ring-red-600";
    case "Excused":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}
