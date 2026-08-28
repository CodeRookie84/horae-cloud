/**
 * Supabase Edge Function: kot-extract
 *
 * Part of the isolated KOT module. Takes the public URL of an uploaded KOT slip
 * (printed DotPe cake invoice + handwritten pen notes) and returns structured
 * JSON for the confirm form. Uses a vision model — far better than classic OCR at
 * reading the handwritten personalisation, which is the whole point of the app.
 *
 * Provider is switchable via KOT_EXTRACT_PROVIDER:
 *   "gemini"    (default) → gemini-2.5-flash-lite, cheapest (needs GEMINI_API_KEY)
 *   "anthropic"           → claude-opus-5 / KOT_EXTRACT_MODEL (needs ANTHROPIC_API_KEY)
 *
 * The result is ALWAYS a draft: the app forces a human confirm step, and the
 * original photo is retained as source of truth. Never trust these fields blind.
 *
 * Isolation: this function is KOT-only. It does not touch notify-dispatcher or
 * any Horae function.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Provider is switchable so you can A/B cost vs handwriting accuracy without a
// code change. Default is Gemini Flash-Lite (cheapest); set KOT_EXTRACT_PROVIDER
// to "anthropic" to use Claude instead.
const PROVIDER = (Deno.env.get("KOT_EXTRACT_PROVIDER") || "gemini").toLowerCase();

const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";
const ANTHROPIC_MODEL    = Deno.env.get("KOT_EXTRACT_MODEL") || "claude-opus-5";
const GEMINI_API_KEY     = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL       = Deno.env.get("KOT_EXTRACT_GEMINI_MODEL") || "gemini-2.5-flash-lite";

const USER_INSTRUCTION = "Extract this KOT into the JSON schema. Pay special attention to any handwritten notes.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// What we ask the model to return. Kept in lockstep with the confirm form in
// src/kot/screens/CaptureConfirm.tsx.
const SYSTEM = `You extract structured data from a bakery's paper KOT (Kitchen Order Ticket) for "Cakewala".
The image is a printed tax invoice (from DotPe) that usually ALSO has handwritten pen notes on it.

Return ONLY a single minified JSON object, no markdown, no commentary, matching exactly:
{
  "invoiceNo": string,            // e.g. "CW2B2627/37593" (printed, top-right)
  "orderDate": string,            // the order/advance-order date as printed, e.g. "Aug 17 2026 09:42 AM"
  "customerName": string,
  "customerPhone": string,        // digits only where possible
  "customerAddress": string,      // the "Deliver To" address; "" if self-pickup
  "deliveryAt": string|null,      // ISO 8601 with +05:30 offset (IST), from "Delivery by ..."; null if absent
  "fulfilment": "pickup"|"delivery",  // "pickup" if self pick-up, else "delivery"
  "billTotal": number,            // Bill Total / grand total
  "advancePaid": number,          // amount already paid; 0 if unclear
  "balanceDue": number,           // balance remaining; 0 if fully paid
  "items": [                      // the PRINTED line items only
    { "name": string, "qty": number, "rate": number, "amount": number }
  ],
  "extraRemarks": [               // EVERY handwritten pen note — the customer's personalisation
    { "text": string }            // transcribe faithfully; keep each distinct note separate
  ],
  "lowConfidenceFields": string[] // names of any fields above you are unsure about (esp. handwriting)
}

Rules:
- Numbers must be plain numbers (no "₹", no commas).
- Do NOT invent the outlet — it is set elsewhere.
- Handwriting is important: capture it under extraRemarks even if messy, and list those fields in lowConfidenceFields.
- If a field is genuinely absent, use "" (or 0 for numbers, null for deliveryAt).`;

serve(handler);

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return json({ error: "imageUrl required" }, 400);
    }

    const text = PROVIDER === "anthropic"
      ? await extractWithAnthropic(imageUrl)
      : await extractWithGemini(imageUrl);
    const parsed = safeParseJson(text);
    if (!parsed) {
      return json({ error: "Could not parse extraction", raw: text }, 502);
    }
    return json({ ok: true, data: parsed });
  } catch (err) {
    console.error("[kot-extract]", err);
    return json({ error: String(err) }, 500);
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

/** Claude vision — reads the slip by URL directly (no download needed). */
async function extractWithAnthropic(imageUrl: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: USER_INSTRUCTION },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  // Skip any thinking blocks; take the first text block.
  return (data.content || []).find((b: any) => b.type === "text")?.text ?? "";
}

/** Gemini can't fetch by URL, so download the slip and send it inline (base64).
 *  responseMimeType forces clean JSON out. Cheapest path (Flash-Lite). */
async function extractWithGemini(imageUrl: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
  const img = await fetch(imageUrl);
  if (!img.ok) throw new Error(`Could not fetch slip image (${img.status})`);
  const mime = img.headers.get("content-type") || "image/jpeg";
  const buf = new Uint8Array(await img.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
  const b64 = btoa(binary);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: "user",
          parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: USER_INSTRUCTION },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
}

/** Tolerates a stray code fence or prose around the JSON object. */
function safeParseJson(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
