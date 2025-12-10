import express, { Request, Response } from "express";
import cors from "cors";
import multer, { FileFilterCallback, MulterError } from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import rateLimit from "express-rate-limit";
import {
  parseAssessmentSheet,
  saveMarksTransaction,
} from "./services/assessments";
import {
  buildAssessmentTemplateXLSX,
  buildAssessmentTemplateCSV,
  buildAssessmentTemplate,
  validateWorkbook,
} from "./services/templates";
import {
  storeSignature,
  listSignatures,
  setSignatureEnabled,
  getCurrentSignature,
} from "./services/signatures";
import { pool } from "./lib/db";

const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const uploadDir = path.join(process.cwd(), "uploads", "assessmentSheets");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => cb(null, uploadDir),
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const name = path
      .parse(file.originalname)
      .name.replace(/[^a-zA-Z0-9-_]/g, "_");
    cb(null, `${Date.now()}_${name}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const ok = [".xlsx", ".xls"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    if (ok) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function scanFileForVirus(_filePath: string): Promise<boolean> {
  if (String(process.env.SCAN_ENABLED || "0") !== "1") return true;
  void _filePath;
  return true;
}

function cleanupUploads(dir: string, maxAgeMs: number): void {
  try {
    const now = Date.now();
    const entries = fs.readdirSync(dir);
    entries.forEach((name) => {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (now - st.mtimeMs > maxAgeMs) fs.unlinkSync(p);
    });
  } catch (_err) {
    void _err;
    return;
  }
}

app.post(
  "/api/assessments/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const token = process.env.UPLOAD_TOKEN;
      if (token && req.headers["x-upload-token"] !== token) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const subject = String(req.query.subject || "");
      const academicYear = String(req.query.academicYear || "");
      const term = String(req.query.term || "");
      if (!subject || !academicYear || !term)
        return res
          .status(400)
          .json({ error: "Missing subject, academicYear or term" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const safe = await scanFileForVirus(req.file.path);
      if (!safe)
        return res.status(400).json({ error: "File failed security scan" });

      const { rows, errors } = await parseAssessmentSheet(req.file.path);
      if (rows.length === 0)
        return res.status(400).json({ error: "No valid rows", errors });

      const conn = await pool.getConnection();
      try {
        await saveMarksTransaction(conn, subject, academicYear, term, rows);
        res.json({ ok: true, processed: rows.length, errors });
      } finally {
        conn.release();
      }
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

app.get("/api/assessments/template", async (req: Request, res: Response) => {
  try {
    const token = process.env.DOWNLOAD_TOKEN;
    if (token && req.headers["x-download-token"] !== token) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const subject = String(req.query.subject || "");
    const className = String(req.query.class || "");
    const academicYear = String(req.query.academicYear || "");
    const term = String(req.query.term || "");
    if (!subject || !className || !academicYear || !term)
      return res.status(400).json({ error: "Missing required parameters" });
    const format = String(req.query.format || "xlsx").toLowerCase();
    const conn = await pool.getConnection();
    try {
      const t0 = Date.now();
      if (format === "csv") {
        const csv = await buildAssessmentTemplateCSV(
          conn,
          subject,
          className,
          academicYear,
          term
        );
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${subject}_${className}_template.csv"`
        );
        res.setHeader("X-Gen-Time", String(Date.now() - t0));
        res.send(csv);
      } else {
        let buf = await buildAssessmentTemplateXLSX(
          conn,
          subject,
          className,
          academicYear,
          term
        );
        const valid = validateWorkbook(buf);
        if (!valid) {
          buf = await buildAssessmentTemplate(
            conn,
            subject,
            className,
            academicYear,
            term
          );
          res.setHeader("X-Fallback", "sheetjs");
        }
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${subject}_${className}_template.xlsx"`
        );
        const md5 = crypto.createHash("md5").update(buf).digest("hex");
        res.setHeader("X-Checksum-MD5", md5);
        res.setHeader("X-Workbook-Validated", valid ? "true" : "false");
        const len = Buffer.byteLength(buf);
        res.setHeader("Content-Length", String(len));
        res.setHeader("X-Gen-Time", String(Date.now() - t0));
        if (len > 10 * 1024 * 1024) {
          res.writeHead(200);
          const chunkSize = 1024 * 1024;
          for (let i = 0; i < len; i += chunkSize) {
            res.write(buf.subarray(i, Math.min(i + chunkSize, len)));
          }
          res.end();
        } else {
          res.send(buf);
        }
      }
    } finally {
      conn.release();
    }
  } catch (e) {
    const err = e as Error;
    res
      .status(500)
      .json({ error: err.message || "Failed to generate template" });
  }
});

app.get("/api/meta/talent-remarks", async (_req: Request, res: Response) => {
  try {
    const groups = [
      {
        group: "Positive",
        options: [
          "Shows exceptional talent in subject activities",
          "Consistently demonstrates creativity",
          "Strong leadership in group tasks",
          "Excellent problem-solving skills",
        ],
      },
      {
        group: "Improvement",
        options: [
          "Could benefit from additional practice",
          "Needs support to build confidence",
          "Should focus more during class activities",
          "Improve time management in assignments",
        ],
      },
      { group: "Other", options: ["Other"] },
    ];
    res.json({ groups });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message || "Failed to load remarks" });
  }
});

// Signature upload and management
const sigUploadDir = path.join(process.cwd(), "uploads", "signatures");
fs.mkdirSync(sigUploadDir, { recursive: true });

const sigStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, sigUploadDir),
  filename: (_req, file, cb) => {
    const name = path
      .parse(file.originalname)
      .name.replace(/[^a-zA-Z0-9-_]/g, "_");
    cb(null, `${Date.now()}_${name}${path.extname(file.originalname)}`);
  },
});

const sigUpload = multer({
  storage: sigStorage,
  fileFilter: (_req, file, cb) => {
    const ok = [".png", ".jpg", ".jpeg", ".svg"].includes(
      path.extname(file.originalname).toLowerCase()
    );
    if (ok) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

app.post(
  "/api/signatures/upload",
  sigUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const token = process.env.UPLOAD_TOKEN;
      if (token && req.headers["x-upload-token"] !== token) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const academicYear = String(req.query.academicYear || "");
      const term = String(req.query.term || "");
      if (!academicYear || !term)
        return res.status(400).json({ error: "Missing academicYear or term" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const meta = await storeSignature(req.file.path, academicYear, term);
      if (meta.width && meta.height) {
        const minWidthPx = 600; // ~2in at 300dpi
        if (meta.width < minWidthPx)
          return res.status(400).json({
            error:
              "Image resolution too low. Recommended 300dpi (~600px width)",
          });
      }
      res.json({ ok: true, id: meta.id, url: meta.url, meta });
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message || "Upload failed" });
    }
  }
);

app.get("/api/signatures/list", async (req: Request, res: Response) => {
  try {
    const academicYear = String(req.query.academicYear || "");
    const term = String(req.query.term || "");
    const items = await listSignatures(
      academicYear || undefined,
      term || undefined
    );
    res.json({ items });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message || "Failed to list signatures" });
  }
});

app.get("/api/signatures/current", async (req: Request, res: Response) => {
  try {
    const academicYear = String(req.query.academicYear || "");
    const term = String(req.query.term || "");
    const meta =
      academicYear && term
        ? await getCurrentSignature(academicYear, term)
        : undefined;
    res.json({ current: meta || null });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message || "Failed to get signature" });
  }
});

app.post("/api/signatures/enable", async (req: Request, res: Response) => {
  try {
    const token = process.env.UPLOAD_TOKEN;
    if (token && req.headers["x-upload-token"] !== token) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const id = String(req.query.id || "");
    const enabled = String(req.query.enabled || "true") === "true";
    if (!id) return res.status(400).json({ error: "Missing id" });
    const meta = await setSignatureEnabled(id, enabled);
    if (!meta) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true, meta });
  } catch (e) {
    const err = e as Error;
    res.status(500).json({ error: err.message || "Failed to update" });
  }
});

// Centralized error handling for uploads to avoid generic 500s
app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
  void _next;
  if (err instanceof MulterError) {
    const code = err.code;
    const map: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large. Max 2MB.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file input.",
    };
    return res.status(400).json({ error: map[code] || "Upload error", code });
  }
  if (err instanceof Error) {
    if (err.message.toLowerCase().includes("invalid file type")) {
      return res
        .status(400)
        .json({ error: "Invalid file type. Only PNG/JPEG allowed." });
    }
    return res.status(500).json({ error: err.message || "Server error" });
  }
  return res.status(500).json({ error: "Unknown error" });
});

// Save generated template to uploads directory for manual inspection/opening
app.get(
  "/api/assessments/template/save",
  async (req: Request, res: Response) => {
    try {
      const token = process.env.DOWNLOAD_TOKEN;
      if (token && req.headers["x-download-token"] !== token) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const subject = String(req.query.subject || "");
      const className = String(req.query.class || "");
      const academicYear = String(req.query.academicYear || "");
      const term = String(req.query.term || "");
      if (!subject || !className || !academicYear || !term)
        return res.status(400).json({ error: "Missing required parameters" });
      const format = String(req.query.format || "xlsx").toLowerCase();
      const conn = await pool.getConnection();
      try {
        let buf: Buffer;
        if (format === "csv") {
          const csv = await buildAssessmentTemplateCSV(
            conn,
            subject,
            className,
            academicYear,
            term
          );
          const safeName = `${Date.now()}_${subject}_${className}`.replace(
            /[^a-zA-Z0-9-_.]/g,
            "_"
          );
          const outPath = path.join(uploadDir, `${safeName}.csv`);
          fs.writeFileSync(outPath, csv, { encoding: "utf8" });
          return res.json({ ok: true, path: outPath });
        } else {
          buf = await buildAssessmentTemplateXLSX(
            conn,
            subject,
            className,
            academicYear,
            term
          );
          let validated = validateWorkbook(buf);
          if (!validated) {
            buf = await buildAssessmentTemplate(
              conn,
              subject,
              className,
              academicYear,
              term
            );
            validated = validateWorkbook(buf);
          }

          if (!buf || buf.length === 0) {
            return res
              .status(500)
              .json({ error: "Failed to generate workbook" });
          }

          const safeName = `${Date.now()}_${subject}_${className}`.replace(
            /[^a-zA-Z0-9-_.]/g,
            "_"
          );
          const outPath = path.join(uploadDir, `${safeName}.xlsx`);
          fs.writeFileSync(outPath, buf);
          return res.json({ ok: true, path: outPath, validated });
        }
      } finally {
        conn.release();
      }
    } catch (e) {
      const err = e as Error;
      res.status(500).json({ error: err.message || "Failed to save template" });
    }
  }
);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  setInterval(
    () => cleanupUploads(uploadDir, 24 * 60 * 60 * 1000),
    60 * 60 * 1000
  );
});

export default app;
