/**
 * Client-side image downscale + JPEG re-encode, run before every KOT upload.
 *
 * Phone cameras emit 3–12 MB photos; uploading those raw is the main source of
 * slow/"hanging" saves — and for the KOT slip that same big file is then fetched
 * and base64'd to the vision model, so it slows extraction too. Shrinking to a
 * sane long-edge + quality (a slip stays legible at ~2200px) turns a multi-MB
 * upload into a few hundred KB. Self-contained (no deps) to keep KOT isolated.
 */

export interface CompressOpts {
  /** Max length of the longer edge, in pixels. */
  maxDim?: number;
  /** JPEG quality 0–1. */
  quality?: number;
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Returns a downscaled JPEG Blob, or the original file if compression can't help
 * or fails (non-image, decode error, or a result that isn't actually smaller).
 * Never throws — a capture must still be uploadable if this misbehaves.
 */
export async function compressImage(file: Blob, opts: CompressOpts = {}): Promise<Blob> {
  const maxDim = opts.maxDim ?? 1800;
  const quality = opts.quality ?? 0.72;
  try {
    const type = (file as File).type || "";
    if (type && !type.startsWith("image/")) return file;

    // Decode. Prefer createImageBitmap with EXIF orientation applied (fast, and
    // correct on modern Android/Chrome — the target devices); fall back to an
    // <img>, which the browser also renders EXIF-oriented when drawn to canvas.
    let width = 0, height = 0;
    let source: CanvasImageSource | null = null;
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      width = bitmap.width; height = bitmap.height; source = bitmap;
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImg(url);
        width = img.naturalWidth; height = img.naturalHeight; source = img;
      } finally { URL.revokeObjectURL(url); }
    }
    if (!width || !height || !source) return file;

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, targetW, targetH);
    if (bitmap) bitmap.close();

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    // Only use it if it actually saved bytes (a tiny original can grow).
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
