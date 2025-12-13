// Endpoint: POST /upload-file
// Request: multipart/form-data with field "file" (File)
// Response (success, 200): { ok: true, bucket, path, size, type, publicUrl? }
// Response (error, 500/400): { ok: false, error }
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET (optional, defaults to "uploads")
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

type Ok = {
  ok: true;
  bucket: string;
  path: string;
  size: number;
  type: string;
  publicUrl?: string;
};
type Err = { ok: false; error: string };

function json(body: Ok | Err, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function sanitizeName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length ? base : "file";
}

function extOf(name: string): string {
  const m = name.match(/(\.[a-zA-Z0-9]+)$/);
  return m ? m[1] : "";
}

function allowedType(type: string, allow: Set<string>): boolean {
  if (!type) return false;
  if (allow.has(type)) return true;
  if (type.startsWith("image/") && allow.has("image/*")) return true;
  return false;
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return json({ ok: false, error: "Unsupported Content-Type" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const bucket = Deno.env.get("SUPABASE_BUCKET") ?? "uploads";

    if (!url || !anon) {
      return json({ ok: false, error: "Supabase not configured" }, 500);
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return json({ ok: false, error: "No file provided" }, 400);

    const maxBytes = Number(Deno.env.get("UPLOAD_MAX_BYTES") ?? 10 * 1024 * 1024);
    if (file.size > maxBytes) return json({ ok: false, error: "File too large" }, 400);

    const allowed = (Deno.env.get("ALLOWED_TYPES") || "image/*,application/pdf").split(",").map((s) => s.trim());
    const allow = new Set<string>(allowed);
    const type = file.type || "application/octet-stream";
    if (!allowedType(type, allow)) return json({ ok: false, error: "Invalid file type" }, 400);

    const client = createClient(url, anon);

    const original = sanitizeName(file.name || "file");
    const id = crypto.randomUUID();
    const ext = extOf(original);
    const base = original.replace(new RegExp(`${ext}$`), "");
    const path = `${base}_${id}${ext}`;

    const { data, error } = await client.storage.from(bucket).upload(path, file, {
      contentType: type,
      upsert: false,
    });
    if (error) return json({ ok: false, error: error.message || "Upload failed" }, 500);

    const pub = client.storage.from(bucket).getPublicUrl(path);
    const body: Ok = {
      ok: true,
      bucket,
      path: data?.path || path,
      size: file.size,
      type,
      publicUrl: pub?.data?.publicUrl,
    };
    return json(body, 200);
  } catch (e) {
    const msg = (e as Error).message || "Unexpected error";
    return json({ ok: false, error: msg }, 500);
  }
});
