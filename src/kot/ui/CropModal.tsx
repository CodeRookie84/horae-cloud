/**
 * CropModal — a lightweight, dependency-free image cropper for the KOT capture
 * flow. Drag the box to move it, drag a corner to resize; "Apply" draws the
 * selected region to a canvas and returns a fresh JPEG File. Pointer events
 * (mouse + touch) drive it, and window-level listeners keep a drag alive even if
 * the finger leaves the image. Self-contained so KOT stays a folder-delete away.
 */
import { useEffect, useRef, useState } from "react";
import { KotButton } from "./primitives";

type Rect = { x: number; y: number; w: number; h: number };
type Mode = "move" | "nw" | "ne" | "sw" | "se";

const MIN = 40; // smallest crop side, in displayed px

export function CropModal({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (f: File) => void }) {
  const [url, setUrl] = useState("");
  const [rect, setRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ mode: Mode; startX: number; startY: number; orig: Rect } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function onImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth, h = img.clientHeight;
    setRect({ x: w * 0.08, y: h * 0.08, w: w * 0.84, h: h * 0.84 });
  }

  function clamp(r: Rect): Rect {
    const img = imgRef.current;
    if (!img) return r;
    const W = img.clientWidth, H = img.clientHeight;
    const w = Math.max(MIN, Math.min(r.w, W));
    const h = Math.max(MIN, Math.min(r.h, H));
    const x = Math.max(0, Math.min(r.x, W - w));
    const y = Math.max(0, Math.min(r.y, H - h));
    return { x, y, w, h };
  }

  function toLocal(clientX: number, clientY: number) {
    const b = imgRef.current!.getBoundingClientRect();
    return { px: clientX - b.left, py: clientY - b.top };
  }

  function begin(mode: Mode, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!rect) return;
    const { px, py } = toLocal(e.clientX, e.clientY);
    drag.current = { mode, startX: px, startY: py, orig: rect };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const { px, py } = toLocal(e.clientX, e.clientY);
      const dx = px - d.startX, dy = py - d.startY;
      const r = { ...d.orig };
      if (d.mode === "move") { r.x += dx; r.y += dy; }
      else {
        if (d.mode.includes("n")) { r.y += dy; r.h -= dy; }
        if (d.mode.includes("s")) { r.h += dy; }
        if (d.mode.includes("w")) { r.x += dx; r.w -= dx; }
        if (d.mode.includes("e")) { r.w += dx; }
      }
      // Prevent a corner drag from inverting the box.
      if (r.w < MIN) { if (d.mode.includes("w")) r.x = d.orig.x + d.orig.w - MIN; r.w = MIN; }
      if (r.h < MIN) { if (d.mode.includes("n")) r.y = d.orig.y + d.orig.h - MIN; r.h = MIN; }
      setRect(clamp(r));
    };
    const end = () => { drag.current = null; setDragging(false); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  async function apply() {
    const img = imgRef.current;
    if (!img || !rect) return;
    setBusy(true);
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w * scaleX));
    canvas.height = Math.max(1, Math.round(rect.h * scaleY));
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); onCancel(); return; }
    ctx.drawImage(img, rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) { onCancel(); return; }
        const base = (file.name || "photo").replace(/\.[^.]+$/, "");
        onDone(new File([blob], `${base}-cropped.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  const handle = "absolute h-6 w-6 rounded-full border-2 border-rose-500 bg-white shadow";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80" onClick={onCancel}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">Crop the slip</span>
        <button onClick={onCancel} className="rounded-lg px-2 py-1 text-white/80 hover:bg-white/10">✕</button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-block" style={{ touchAction: "none" }}>
          <img
            ref={imgRef}
            src={url}
            alt="Crop"
            onLoad={onImgLoad}
            draggable={false}
            className="block max-h-[68vh] w-auto select-none rounded-lg"
          />
          {rect && (
            <>
              {/* Crop window — the huge box-shadow dims everything outside it. */}
              <div
                className="absolute cursor-move border-2 border-white"
                style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
                onPointerDown={(e) => begin("move", e)}
              />
              <div className={handle} style={{ left: rect.x - 12, top: rect.y - 12 }} onPointerDown={(e) => begin("nw", e)} />
              <div className={handle} style={{ left: rect.x + rect.w - 12, top: rect.y - 12 }} onPointerDown={(e) => begin("ne", e)} />
              <div className={handle} style={{ left: rect.x - 12, top: rect.y + rect.h - 12 }} onPointerDown={(e) => begin("sw", e)} />
              <div className={handle} style={{ left: rect.x + rect.w - 12, top: rect.y + rect.h - 12 }} onPointerDown={(e) => begin("se", e)} />
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <KotButton variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">Cancel</KotButton>
        <KotButton onClick={apply} disabled={busy} className="flex-1">{busy ? "Cropping…" : "Apply crop"}</KotButton>
      </div>
    </div>
  );
}
