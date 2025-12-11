import { logger } from "./logger";

type Kind = "upload" | "download";

export type StoredItemMeta = {
  id: string;
  kind: Kind;
  timestamp: number;
  size: number;
  type: string;
  encrypted?: boolean;
  iv?: string;
  salt?: string;
  tags?: string[];
};

type SaveOptions = {
  id?: string;
  kind: Kind;
  type: string;
  encrypt?: boolean;
  passphrase?: string;
  tags?: string[];
};

const LS_NS = "STORAGE::";
const LS_INDEX = `${LS_NS}INDEX`;
const LS_QUOTA_BYTES = 5 * 1024 * 1024;
const IDB_DB = "esba-storage";
const IDB_STORE = "files";

const enc = new TextEncoder();
const dec = new TextDecoder();

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function toBase64Bytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(str: string): ArrayBuffer {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(
  data: ArrayBuffer,
  passphrase: string
): Promise<{ buf: ArrayBuffer; iv: Uint8Array; salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data
  );
  return { buf, iv, salt };
}

async function decryptData(
  data: ArrayBuffer,
  passphrase: string,
  iv: Uint8Array,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const key = await deriveKey(passphrase, salt);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data
  );
}

function readIndex(): Record<string, StoredItemMeta> {
  try {
    const raw = localStorage.getItem(LS_INDEX);
    return raw ? (JSON.parse(raw) as Record<string, StoredItemMeta>) : {};
  } catch {
    return {};
  }
}

function writeIndex(idx: Record<string, StoredItemMeta>): void {
  try {
    localStorage.setItem(LS_INDEX, JSON.stringify(idx));
  } catch (e) {
    logger.warn("storage_index_write_failed", e);
  }
}

function localStorageBytesUsed(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      const v = localStorage.getItem(k) || "";
      total += k.length + v.length;
    }
    return total;
  } catch {
    return 0;
  }
}

function validateMeta(meta: StoredItemMeta): boolean {
  return (
    !!meta.id && !!meta.kind && typeof meta.size === "number" && !!meta.type
  );
}

async function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(meta: StoredItemMeta, data: ArrayBuffer): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.put({ ...meta, data });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(
  id: string
): Promise<{ meta: StoredItemMeta; data: ArrayBuffer } | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const v = req.result as
        | (StoredItemMeta & { data: ArrayBuffer })
        | undefined;
      resolve(v ? { meta: v, data: v.data } : null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveData(
  data: ArrayBuffer | string,
  options: SaveOptions
): Promise<{ id: string; meta: StoredItemMeta }> {
  const id = options.id || uid();
  const ts = Date.now();
  const buf = typeof data === "string" ? enc.encode(data).buffer : data;
  let toStore = buf;
  let iv: Uint8Array | undefined;
  let salt: Uint8Array | undefined;
  if (options.encrypt && options.passphrase) {
    try {
      const encd = await encryptData(buf, options.passphrase);
      toStore = encd.buf;
      iv = encd.iv;
      salt = encd.salt;
    } catch (e) {
      logger.error("storage_encrypt_failed", e);
      throw e;
    }
  }
  const size = toStore.byteLength;
  const meta: StoredItemMeta = {
    id,
    kind: options.kind,
    timestamp: ts,
    size,
    type: options.type,
    encrypted: !!options.encrypt,
    iv: iv ? toBase64Bytes(iv) : undefined,
    salt: salt ? toBase64Bytes(salt) : undefined,
    tags: options.tags || [],
  };
  if (!validateMeta(meta)) throw new Error("Invalid metadata");
  try {
    const lsUsed = localStorageBytesUsed();
    if (size + lsUsed < LS_QUOTA_BYTES) {
      const idx = readIndex();
      idx[id] = meta;
      writeIndex(idx);
      const payload = toBase64(toStore);
      localStorage.setItem(`${LS_NS}${id}`, payload);
      logger.info("storage_saved_local", { id, size });
      return { id, meta };
    }
  } catch (e) {
    logger.warn("storage_local_failed_fallback_idb", e);
  }
  try {
    await idbPut(meta, toStore);
    logger.info("storage_saved_idb", { id, size });
    return { id, meta };
  } catch (e) {
    logger.error("storage_idb_save_failed", e);
    throw e;
  }
}

export async function getData(
  id: string,
  passphrase?: string
): Promise<{ meta: StoredItemMeta; data: ArrayBuffer | string } | null> {
  try {
    const idx = readIndex();
    const meta = idx[id];
    if (meta) {
      const raw = localStorage.getItem(`${LS_NS}${id}`);
      if (!raw) return null;
      let buf = fromBase64(raw);
      if (meta.encrypted && passphrase && meta.iv && meta.salt) {
        buf = await decryptData(
          buf,
          passphrase,
          new Uint8Array(fromBase64(meta.iv)),
          new Uint8Array(fromBase64(meta.salt))
        );
      }
      const isText =
        /^text\//.test(meta.type) || meta.type === "application/json";
      return { meta, data: isText ? dec.decode(buf) : buf };
    }
  } catch (e) {
    logger.warn("storage_local_get_failed", e);
  }
  try {
    const v = await idbGet(id);
    if (!v) return null;
    let buf = v.data;
    const meta = v.meta;
    if (meta.encrypted && passphrase && meta.iv && meta.salt) {
      buf = await decryptData(
        buf,
        passphrase,
        new Uint8Array(fromBase64(meta.iv)),
        new Uint8Array(fromBase64(meta.salt))
      );
    }
    const isText =
      /^text\//.test(meta.type) || meta.type === "application/json";
    return { meta, data: isText ? dec.decode(buf) : buf };
  } catch (e) {
    logger.error("storage_idb_get_failed", e);
    return null;
  }
}

export async function list(
  filter?: Partial<{ kind: Kind; type: string; before: number; after: number }>
): Promise<StoredItemMeta[]> {
  const out: StoredItemMeta[] = [];
  try {
    const idx = readIndex();
    Object.values(idx).forEach((m) => out.push(m));
  } catch {
    void 0;
  }
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result as IDBCursorWithValue | null;
        if (!cur) return resolve();
        const v = cur.value as StoredItemMeta;
        out.push(v);
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    void 0;
  }
  const f = filter || {};
  return out.filter((m) => {
    if (f.kind && m.kind !== f.kind) return false;
    if (f.type && m.type !== f.type) return false;
    if (typeof f.before === "number" && m.timestamp >= f.before) return false;
    if (typeof f.after === "number" && m.timestamp <= f.after) return false;
    return true;
  });
}

export async function remove(id: string): Promise<void> {
  try {
    const idx = readIndex();
    delete idx[id];
    writeIndex(idx);
    localStorage.removeItem(`${LS_NS}${id}`);
  } catch {
    void 0;
  }
  try {
    await idbDelete(id);
  } catch {
    void 0;
  }
}

export async function cleanup(
  options: Partial<{
    maxAgeMs: number;
    predicate: (m: StoredItemMeta) => boolean;
    limit: number;
  }>
): Promise<number> {
  const items = await list();
  const now = Date.now();
  const pred = options.predicate || (() => true);
  const maxAgeMs = options.maxAgeMs || 0;
  const toRemove: StoredItemMeta[] = [];
  for (const m of items) {
    if (maxAgeMs && now - m.timestamp > maxAgeMs) toRemove.push(m);
    else if (pred(m)) toRemove.push(m);
    if (options.limit && toRemove.length >= options.limit) break;
  }
  for (const m of toRemove) await remove(m.id);
  logger.info("storage_cleanup", { removed: toRemove.length });
  return toRemove.length;
}

export async function getUsage(): Promise<{
  quota?: number;
  usage?: number;
  lsBytes: number;
}> {
  const lsBytes = localStorageBytesUsed();
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return { quota: est.quota, usage: est.usage, lsBytes };
    }
  } catch {
    void 0;
  }
  return { lsBytes };
}

export async function saveUploadedFile(
  id: string | undefined,
  file: File,
  tags?: string[],
  passphrase?: string
): Promise<{ id: string; meta: StoredItemMeta }> {
  const buf = await file.arrayBuffer();
  return saveData(buf, {
    id,
    kind: "upload",
    type: file.type || "application/octet-stream",
    encrypt: !!passphrase,
    passphrase,
    tags,
  });
}

export async function saveDownloadedContent(
  id: string | undefined,
  content: ArrayBuffer | string,
  type: string,
  tags?: string[],
  passphrase?: string
): Promise<{ id: string; meta: StoredItemMeta }> {
  return saveData(content, {
    id,
    kind: "download",
    type,
    encrypt: !!passphrase,
    passphrase,
    tags,
  });
}
