/**
 * CameraCapture — take a photo (rear camera on mobile via `capture`), preview it,
 * and Retake before confirming. Reused for the KOT slip, the cake drawing, and
 * the mandatory Ready/Collected status photos. Returns the raw File to the parent
 * on confirm; uploading is the parent's job.
 */
import { useRef, useState } from "react";
import { KotButton, cn } from "./primitives";

export function CameraCapture({
  onCapture,
  ctaLabel = "Take photo",
  confirmLabel = "Use photo",
  hint,
  busy = false,
  compact = false,
}: {
  onCapture: (file: File) => void;
  ctaLabel?: string;
  confirmLabel?: string;
  hint?: string;
  busy?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    e.target.value = ""; // allow re-pick of the same file
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    pick();
  }

  function confirm() {
    if (file) onCapture(file);
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      {!preview ? (
        <button
          type="button"
          onClick={pick}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 text-rose-600 transition-colors hover:bg-rose-50",
            compact ? "h-28" : "h-52",
          )}
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-semibold">{ctaLabel}</span>
          {hint && <span className="px-6 text-center text-xs text-slate-500">{hint}</span>}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <img
            src={preview}
            alt="Captured"
            className={cn("w-full rounded-2xl border border-slate-200 object-contain", compact ? "max-h-48" : "max-h-80")}
          />
          <div className="flex gap-2">
            <KotButton variant="secondary" onClick={retake} disabled={busy} className="flex-1">
              ↺ Retake
            </KotButton>
            <KotButton onClick={confirm} disabled={busy} className="flex-1">
              {busy ? "Working…" : confirmLabel}
            </KotButton>
          </div>
        </div>
      )}
    </div>
  );
}
