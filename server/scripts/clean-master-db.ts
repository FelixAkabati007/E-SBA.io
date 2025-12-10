import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

async function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (e) {
    // ignore if already exists or cannot create
    void e;
  }
}

async function backupTable(conn: mysql.Connection, table: string, outDir: string, ts: string) {
  const [rows] = await conn.query(`SELECT * FROM ${table}`);
  const file = path.join(outDir, `${ts}_${table}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), { encoding: "utf8" });
  return file;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "esba_app_user",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "esba_jhs_db",
    multipleStatements: true,
  });

  const backupsDir = path.join(process.cwd(), "server", "backups");
  await ensureDir(backupsDir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    // Backup critical tables before cleanup
    const backedUp = [] as string[];
    for (const t of ["students", "assessments", "academic_sessions", "audit_logs"]) {
      const f = await backupTable(conn, t, backupsDir, ts);
      backedUp.push(f);
    }

    await conn.beginTransaction();

    // Remove related data first to avoid FK issues
    await conn.query("DELETE FROM assessments");
    await conn.query("DELETE FROM audit_logs");
    await conn.query("DELETE FROM academic_sessions");
    // Delete students (master records)
    await conn.query("DELETE FROM students");

    // Verify empty state for student-related queries within the transaction
    const [sCountRows] = await conn.query("SELECT COUNT(*) AS c FROM students");
    const [aCountRows] = await conn.query("SELECT COUNT(*) AS c FROM assessments");
    const [sessCountRows] = await conn.query("SELECT COUNT(*) AS c FROM academic_sessions");
    const sCount = (sCountRows as Array<{ c: number }>)[0]?.c ?? 0;
    const aCount = (aCountRows as Array<{ c: number }>)[0]?.c ?? 0;
    const sessCount = (sessCountRows as Array<{ c: number }>)[0]?.c ?? 0;

    if (sCount !== 0 || aCount !== 0 || sessCount !== 0) {
      throw new Error("Cleanup verification failed: expected zero counts");
    }

    await conn.commit();

    // Reset auto-increment counters (DDL causes implicit commit; perform after transactional deletes)
    await conn.query("ALTER TABLE assessments AUTO_INCREMENT = 1");
    await conn.query("ALTER TABLE audit_logs AUTO_INCREMENT = 1");
    await conn.query("ALTER TABLE academic_sessions AUTO_INCREMENT = 1");

    // Final verification
    const [finalStudents] = await conn.query("SELECT COUNT(*) AS c FROM students");
    const [finalAssessments] = await conn.query("SELECT COUNT(*) AS c FROM assessments");
    const [finalSessions] = await conn.query("SELECT COUNT(*) AS c FROM academic_sessions");
    const [finalAudit] = await conn.query("SELECT COUNT(*) AS c FROM audit_logs");

    const report = {
      ok: true,
      backups: backedUp,
      counts: {
        students: (finalStudents as Array<{ c: number }>)[0]?.c ?? 0,
        assessments: (finalAssessments as Array<{ c: number }>)[0]?.c ?? 0,
        academic_sessions: (finalSessions as Array<{ c: number }>)[0]?.c ?? 0,
        audit_logs: (finalAudit as Array<{ c: number }>)[0]?.c ?? 0,
      },
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    try { await conn.rollback(); } catch (rollbackErr) { void rollbackErr; }
    console.error((e as Error)?.message || e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
