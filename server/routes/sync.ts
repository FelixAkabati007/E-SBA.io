import express, { Request, Response } from "express";
import { applyChanges, listChanges, getCheckpoint } from "../services/sync";

const router = express.Router();

let lastPushed: Array<{ id: string; ts: number }> = [];

router.get("/checkpoint", async (_req: Request, res: Response) => {
  const cp = await getCheckpoint();
  res.json({ checkpoint: cp });
});

router.get("/pull", async (req: Request, res: Response) => {
  try {
    const sinceRaw = Number(req.query.since || 0);
    const limitRaw = Number(req.query.limit || 1000);
    const since = Number.isFinite(sinceRaw) && sinceRaw >= 0 ? sinceRaw : 0;
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(10000, limitRaw))
      : 1000;
    const changeItems = await listChanges(since, limit);
    const { listStudents } = await import("../services/blobdb");
    const studs = await listStudents();
    const snapshotItems =
      since === 0
        ? studs.map((s) => ({
            ts: Date.now(),
            id: s.id,
            type: "upsert" as const,
            url: s.url,
          }))
        : [];
    const pushedItems = lastPushed.map((p) => ({
      ts: p.ts,
      id: p.id,
      type: "upsert" as const,
      url: undefined as string | undefined,
    }));
    const allItems: Array<{
      ts: number;
      id: string;
      type: "upsert" | "delete";
      url?: string;
    }> = (
      [] as Array<{
        ts: number;
        id: string;
        type: "upsert" | "delete";
        url?: string;
      }>
    )
      .concat(
        changeItems as Array<{
          ts: number;
          id: string;
          type: "upsert" | "delete";
          url?: string;
        }>
      )
      .concat(snapshotItems)
      .concat(pushedItems);
    const seen = new Set<string>();
    const merged: Array<{
      ts: number;
      id: string;
      type: "upsert" | "delete";
      url?: string;
    }> = [];
    for (const it of allItems.sort((a, b) => b.ts - a.ts)) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
      if (merged.length >= limit) break;
    }
    console.info("[sync_pull]", {
      since,
      limit,
      changeCount: changeItems.length,
      snapshotCount: snapshotItems.length,
      pushedCount: pushedItems.length,
      mergedCount: merged.length,
    });
    res.json({ items: merged });
  } catch (e) {
    const msg = (e as Error)?.message || "Pull failed";
    console.warn("[sync_pull_error]", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/push", async (req: Request, res: Response) => {
  const token =
    process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_RW_TOKEN;
  const hdr = String(req.headers["x-blob-token"] || "");
  if (token && hdr !== token)
    return res.status(403).json({ error: "Forbidden" });
  try {
    const body = req.body as Record<string, unknown>;
    const changes = (body.changes || []) as Array<Record<string, unknown>>;
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: "Invalid changes payload" });
    }
    const mapped = changes.map((c) => ({
      id: String(c.id || ""),
      type: String(c.type || "upsert") as "upsert" | "delete",
      doc: c.doc as Record<string, unknown> | undefined,
      version: Number(c.version || 1),
      clientId: String(c.clientId || "client"),
      timestamp: Number(c.timestamp || Date.now()),
    }));
    const resu = await applyChanges(mapped);
    console.info("[sync_push]", { count: mapped.length });
    try {
      lastPushed = mapped.map((m) => ({ id: m.id, ts: m.timestamp }));
    } catch {
      void 0;
    }
    res.json(resu);
  } catch (e) {
    const msg = (e as Error)?.message || "Push failed";
    console.warn("[sync_push_error]", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
