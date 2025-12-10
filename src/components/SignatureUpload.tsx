import React, { useEffect, useRef, useState } from "react";
import { logger } from "../lib/logger";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";

/**
 * Headmaster Signature uploader component.
 * Mirrors School Profile upload UX while using backend storage and versioning.
 * Accepts PNG/JPEG/SVG, validates size, previews uploaded asset, and posts to /api.
 */
export default function SignatureUpload(props: {
  value: string | null;
  onChange: (url: string | null) => void;
  academicYear: string;
  term: string;
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
}) {
  const { value, onChange, academicYear, term, enabled, onToggleEnabled } =
    props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const STORAGE_PREFIX = "E_SBA_HEAD_SIGNATURE::";
  const ttlMs = 7 * 24 * 60 * 60 * 1000;
  const storageKey = `${STORAGE_PREFIX}${academicYear}::${term}`;

  const cleanupExpired = () => {
    try {
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          try {
            const rec = JSON.parse(raw) as { expiresAt?: number };
            if (rec?.expiresAt && rec.expiresAt < now) {
              localStorage.removeItem(k);
            }
          } catch (err) {
            logger.warn("Signature cleanup parse error", err);
          }
        }
      }
    } catch (err) {
      logger.warn("Signature cleanup failed", err);
    }
  };

  const loadFromLocal = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const rec = JSON.parse(raw) as {
        dataUrl: string;
        filename: string;
        timestamp: number;
        size: number;
        type: string;
        expiresAt: number;
      };
      const remain = Math.max(0, rec.expiresAt - Date.now());
      const days = Math.floor(remain / (24 * 60 * 60 * 1000));
      setStatus(
        days > 0 ? `Stored locally • expires in ${days}d` : "Stored locally"
      );
      return rec;
    } catch (err) {
      logger.warn("Signature load failed", err);
      return null;
    }
  };

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    const validTypes = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type.");
      setBusy(false);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File too large.");
      setBusy(false);
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dataUrl = reader.result as string;
          const rec = {
            dataUrl,
            filename: file.name,
            timestamp: Date.now(),
            size: file.size,
            type: file.type,
            expiresAt: Date.now() + ttlMs,
          };
          localStorage.setItem(storageKey, JSON.stringify(rec));
          onChange(dataUrl);
          const days = Math.floor(ttlMs / (24 * 60 * 60 * 1000));
          setStatus(`Stored locally • expires in ${days}d`);
        } catch (err) {
          setError("Storage failed.");
          logger.error("Signature storage failed", err);
        } finally {
          setBusy(false);
        }
      };
      reader.onerror = () => {
        setError("Read failed.");
        setBusy(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setBusy(false);
    }
  }

  function remove() {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
    try {
      localStorage.removeItem(storageKey);
      setStatus("");
    } catch (err) {
      logger.warn("Signature remove local failed", err);
    }
  }

  useEffect(() => {
    cleanupExpired();
    if (!value) {
      const rec = loadFromLocal();
      if (rec?.dataUrl) onChange(rec.dataUrl);
    } else {
      const rec = loadFromLocal();
      if (!rec) setStatus("");
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Upload Signature (.png, .jpeg, .svg)
        </label>
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative group w-56 h-24 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
            {value ? (
              <img
                src={value}
                alt="Headmaster Signature"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <ImageIcon className="text-slate-300" size={36} />
            )}
            {busy && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={24} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 w-full">
            <input
              type="file"
              ref={inputRef}
              onChange={handleUpload}
              accept=".png,.jpg,.jpeg,.svg"
              className="hidden"
              aria-label="Upload headmaster signature"
              title="Upload headmaster signature"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded hover:bg-blue-200 transition-colors"
            >
              <Upload size={14} /> Upload
            </button>
            {value && (
              <button
                onClick={remove}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100 transition-colors"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          <div className="text-center">
            {error ? (
              <p className="text-xs text-red-600 flex items-center gap-1 justify-center">
                <AlertCircle size={12} /> {error}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Max 2MB • PNG/JPEG/SVG • Recommended high resolution
              </p>
            )}
          </div>
          {status && <p className="text-xs text-emerald-700">{status}</p>}
          <div className="flex items-center gap-2">
            <label
              htmlFor="signature-enabled"
              className="text-sm text-slate-700"
            >
              Display on reports
            </label>
            <input
              id="signature-enabled"
              type="checkbox"
              checked={!!enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              aria-label="Toggle signature display on report cards"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
