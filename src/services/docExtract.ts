/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Client-side text extraction from Office files. A .pptx / .docx is a ZIP of XML,
// so we unzip it in the browser (fflate) and read the text nodes — no server, no
// upload beyond the storage the app already uses, and the file never leaves the
// user's machine for extraction. Used to auto-fill the Training "source notes".

import { unzipSync, strFromU8 } from "fflate";

/** Join paragraph text from an XML string, one line per paragraph. */
function paragraphsToText(xml: string, paraTag: string, textTag: string): string {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(xml, "application/xml"); }
  catch { return ""; }
  const paras = Array.from(doc.getElementsByTagName(paraTag));
  const lines: string[] = [];
  for (const p of paras) {
    const runs = Array.from(p.getElementsByTagName(textTag)).map(t => t.textContent || "");
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

const slideNo = (name: string) => parseInt((name.match(/(\d+)\.xml$/) || [])[1] || "0", 10);

/**
 * Extract readable text from a PPTX or DOCX File. Returns "" for other types
 * (PDFs are read directly by Gemini) or if the file can't be unzipped.
 */
export async function extractDocText(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const isPptx = name.endsWith(".pptx") || /presentation/i.test(file.type);
  const isDocx = name.endsWith(".docx") || /wordprocessingml/i.test(file.type);
  if (!isPptx && !isDocx) return "";

  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch { return ""; }

  if (isDocx) {
    const doc = files["word/document.xml"];
    return doc ? paragraphsToText(strFromU8(doc), "w:p", "w:t") : "";
  }

  // PPTX — slides in order, then speaker notes.
  const slides = Object.keys(files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const noteFiles = Object.keys(files)
    .filter(n => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));

  const parts: string[] = [];
  slides.forEach((n, i) => {
    const t = paragraphsToText(strFromU8(files[n]), "a:p", "a:t");
    if (t.trim()) parts.push(`Slide ${i + 1}:\n${t}`);
  });
  const notes = noteFiles
    .map(n => paragraphsToText(strFromU8(files[n]), "a:p", "a:t"))
    .filter(s => s.trim());
  if (notes.length) parts.push("Speaker notes:\n" + notes.join("\n"));

  return parts.join("\n\n").trim();
}
