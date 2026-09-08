/**
 * CameraCapture — capture a photo (rear camera on mobile) OR upload one from the
 * gallery/files, preview it, optionally Crop it, and Retake before confirming.
 * Reused for the KOT slip, the cake drawing, and the mandatory Ready/Collected
 * status photos. Returns the raw File to the parent on confirm; uploading is the
 * parent's job.
 */
import { useRef, useState } from "react";
import { KotButton, cn } from "./primitives";
import { CropModal } from "./CropModal";

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  function setPicked(f: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-pick of the same file
    if (f) setPicked(f);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  function confirm() {
    if (file) onCapture(file);
  }

  return (
    <div className="w-full">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {!preview ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/50 text-rose-600 transition-colors hover:bg-rose-50",
              compact ? "h-28" : "h-52",
            )}
          >
            <span className="text-3xl">📷</span>
            <span className="text-sm font-semibold">{ctaLabel}</span>
            {hint && <span className="px-6 text-center text-xs text-slate-500">{hint}</span>}
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <span>📁</span> Upload from gallery
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <img
            src={preview}
            alt="Captured"
            className={cn("w-full rounded-2xl border border-slate-200 object-contain", compact ? "max-h-48" : "max-h-80")}
          />
          <div className="grid grid-cols-3 gap-2">
            <KotButton variant="secondary" onClick={retake} disabled={busy} className="w-full">↺ Retake</KotButton>
            <KotButton variant="secondary" onClick={() => setCropping(true)} disabled={busy} className="w-full">✂️ Crop</KotButton>
            <KotButton onClick={confirm} disabled={busy} className="w-full">{busy ? "Working…" : confirmLabel}</KotButton>
          </div>
        </div>
      )}

      {cropping && file && (
        <CropModal
          file={file}
          onCancel={() => setCropping(false)}
          onDone={(f) => { setPicked(f); setCropping(false); }}
        />
      )}
    </div>
  );
}
