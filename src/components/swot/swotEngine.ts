/**
 * swotEngine.ts — types + the deterministic SWOT derivation engine for the
 * SWOT Compass feature. The data tables it reads live in swotData.ts (extracted
 * verbatim from the original tool). This file is a faithful TypeScript port of
 * the original deriveSWOT/detectRung logic, plus a hospitality/bakery benchmark
 * profile added on top of the extracted set (matched first) so kitchen / floor /
 * cashier staff get a relevant career roadmap.
 */
import { I18N, LIKERT, TEXTS, BENCHMARKS } from './swotData';

export type Lang = 'en' | 'hi' | 'kn' | 'bn';

export interface QState {
  step: number;
  role: string;
  industry: string;
  file: string;
  likert: Record<string, number>;
  texts: Record<string, string>;
}

export interface AnalysisRecord {
  role: string;
  industry: string;
  file: string;
  s: string[];
  w: string[];
  o: string[];
  t: string[];
  sMore: string;
  wMore: string;
  oMore: string;
  tMore: string;
  answers: { likert: Record<string, number>; texts: Record<string, string> };
  completedAt?: string;
}

// ── i18n helpers ──────────────────────────────────────────────────────────────
export const tr = (lang: Lang, k: string): string =>
  ((I18N as any)[lang] && (I18N as any)[lang][k]) || (I18N as any).en[k] || k;

export const fmt = (s: string, vars?: Record<string, any>): string =>
  s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? String(vars[k]) : `{${k}}`));

// ── Hospitality / bakery / café profile (added on top of the extracted set) ──
// Placed first in getBenchmarks() so bakery/kitchen/floor/cashier titles match
// this before the generic hotel/travel "hospitality" profile or the catch-all.
const BAKERY_BENCHMARK = {
  match: /baker|bakery|pastry|patiss|pâtiss|confection|\bcake\b|barista|\bcafe\b|café|coffee|\bcook\b|chef|kitchen|counter|cashier|steward|waiter|\bserver\b|\bf&b\b|quick service|\bqsr\b|restaurant|outlet staff|floor staff|packing/i,
  skills: [
    'Food quality, consistency & hygiene (FSSAI/HACCP)',
    'Speed and accuracy under rush-hour pressure',
    'Warm guest service & upselling at the counter',
    'Stock, wastage & billing discipline',
  ],
  trends: [
    'Online ordering & delivery aggregators reshaping the counter',
    'Cloud kitchens and delivery-first formats',
    'Premium, health-conscious and eggless / vegan demand',
  ],
  grow: [
    { skill: 'Recipe & portion standardisation', why: 'Consistency across every outlet and shift is what turns a good bakery into a trusted brand — and what gets you noticed for a lead role.' },
    { skill: 'Food safety & hygiene certification (FSSAI/HACCP)', why: 'Certified hands are trusted with more responsibility, audits and new outlets — it is the clearest signal of a professional, not just a worker.' },
    { skill: 'Billing, POS & basic stock/wastage tracking', why: 'Whoever controls waste and gets the numbers right is who managers groom to run a counter or an outlet.' },
  ],
  courses: [
    { name: 'FSSAI Food Safety Supervisor (FoSTaC) training', by: 'FSSAI, India' },
    { name: 'Bakery & Confectionery craft courses', by: 'IHM / state food-craft institutes' },
    { name: 'Barista & café operations basics', by: 'Coursera / YouTube, many free' },
    { name: 'Customer service & upselling fundamentals', by: 'LinkedIn Learning' },
  ],
  levelUp: [
    'Own one station end-to-end (production, counter or billing) and keep its wastage and complaints low — measurably.',
    'Get FSSAI / food-safety certified; it is the fastest way to be trusted with more.',
    'Learn the POS and daily closing numbers even if it is not your job yet.',
    'Train one new joiner well — the person who can build a team is the person who gets promoted to run one.',
  ],
  caseStudies: [
    { title: "Theobroma: from one Colaba counter to a national brand",
      body: "Kainaz and Tina Messman Harchandrai opened a single small patisserie in Mumbai in 2004. By obsessing over consistent quality and standardised recipes, they grew Theobroma into a chain of over a hundred outlets across India — proof that repeatable craft, not just one great baker, is what scales.",
      takeaway: 'Consistency you can teach to others is worth more than talent that lives in one pair of hands.' },
    { title: "Karachi Bakery: one recipe, decades of trust",
      body: "Starting from a single shop in Hyderabad in 1953, Karachi Bakery built a nationally recognised name almost entirely on the reliability of a few signature products — the same taste, every time, for generations of customers.",
      takeaway: 'A brand is built on the customer knowing exactly what they will get, every single time.' },
  ],
  story: {
    title: 'From cleaning tables to running the kitchen',
    body: "Many of India's most respected chefs and outlet managers started at the very bottom — washing utensils, carrying trays, working the counter — and moved up by mastering one station at a time, staying reliable, and saying yes to learning the next skill. The ladder in food service is one of the most open there is: attitude and consistency are visible every single day.",
    quote: 'Do the small job so well that they cannot help but give you the bigger one.',
  },
  ladder: [
    { title: 'Trainee / Kitchen Helper / Commis', years: '0–1 yrs', focus: 'Learning hygiene, prep and the basics of one station under supervision.', re: /trainee|helper|commis|apprentice|intern|packer/i },
    { title: 'Baker / Cook / Counter Staff / Cashier', years: '1–3 yrs', focus: 'Runs a station, counter or till independently, with consistent quality.' },
    { title: 'Senior Baker / Head Cook / Shift Supervisor', years: '3–6 yrs', focus: 'Owns a shift or section, checks quality and guides juniors.', re: /senior|shift|supervisor|head cook|head baker|captain/i },
    { title: 'Outlet / Store Manager', years: '6–10 yrs', focus: "Owns one outlet's sales, staff, stock and customer experience.", re: /manager|outlet manager|store manager/i },
    { title: 'Area Manager / Operations Head / Owner', years: '10+ yrs', focus: 'Sets standards and owns the numbers across multiple outlets.', re: /area manager|operations|regional|owner|director|head of/i },
  ],
};

/** All benchmark profiles, bakery/café first so food-service titles match it. */
export function getBenchmarks(): any[] {
  return [BAKERY_BENCHMARK, ...(BENCHMARKS as any[])];
}

/** The benchmark profile best matching a role + industry (catch-all guarantees a hit). */
export function getBenchmark(role: string, industry: string): any {
  const probe = `${role} ${industry}`;
  const all = getBenchmarks();
  return all.find(x => x.match.test(probe)) || all[all.length - 1];
}

/**
 * Which ladder rung best matches a job title, checked executive → entry
 * (first match wins). Falls back to the core IC rung (index 1).
 */
export function detectRung(role: string, ladder: any[]): number {
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i].re && ladder[i].re.test(role)) return i;
  }
  return 1;
}

export function blankQ(): QState {
  const likert: Record<string, number> = {};
  (LIKERT as any[]).forEach(i => { likert[i.id] = 0; });
  const texts: Record<string, string> = {};
  (TEXTS as any[]).forEach(i => { texts[i.id] = ''; });
  return { step: 0, role: '', industry: '', file: '', likert, texts };
}

/**
 * Turns the indirect Likert answers + free-text descriptions into the SWOT
 * matrix — a faithful port of the original deriveSWOT. Likert ≥4 fires an
 * item's "high" insight, ≤2 fires its "low" insight, each into its quadrant.
 * Descriptions are distilled + attributed, with criticism/threat cue words
 * routing feedback and future notes into the right quadrant.
 */
export function deriveSWOT(q: QState, lang: Lang): { s: string[]; w: string[]; o: string[]; t: string[] } {
  const t = (k: string) => tr(lang, k);
  const out: { s: string[]; w: string[]; o: string[]; t: string[] } = { s: [], w: [], o: [], t: [] };

  (LIKERT as any[]).forEach(item => {
    const v = q.likert[item.id];
    if (v >= 4 && item.high) (out as any)[item.high.q].push(t(item.high.k));
    if (v > 0 && v <= 2 && item.low) (out as any)[item.low.q].push(t(item.low.k));
  });

  const distill = (s: string) => {
    s = s.trim().replace(/\s+/g, ' ');
    return s.length > 110 ? s.slice(0, 110).replace(/\s\S*$/, '') + '…' : s;
  };
  const quote = (s: string) => `${t('fromYourWords')} “${distill(s)}”`;

  if (q.texts.proud) out.s.push(quote(q.texts.proud));
  if (q.texts.drain) out.w.push(quote(q.texts.drain));

  if (q.texts.feedback) {
    const criticism = /(improve|should|slow|late|too |need to|needs|lack|miss|weak|avoid|better|not enough|कमी|सुधार|देरी|धीमे|ಸುಧಾರ|ನಿಧಾನ|ಕೊರತೆ|উন্নতি|দেরি|ঘাটতি|ধীর)/i.test(q.texts.feedback);
    (out as any)[criticism ? 'w' : 's'].push(quote(q.texts.feedback));
  }

  if (q.texts.future) {
    const threatRe = /(automat|\bai\b|layoff|job cut|cutback|replac|outsourc|shrink|competit|obsolete|redundan|declin|downsiz|छंटनी|स्वचालन|प्रतिस्पर्धा|खतरा|ಆಟೊಮೇಷನ್|ಸ್ಪರ್ಧೆ|ಅಪಾಯ|ছাঁটাই|অটোমেশন|প্রতিযোগিতা|ঝুঁকি)/i;
    q.texts.future.split(/(?<=[.!?।])\s+/).map(p => p.trim()).filter(Boolean)
      .forEach(p => (out as any)[threatRe.test(p) ? 't' : 'o'].push(quote(p)));
  }

  if (!out.s.length) out.s.push(t('dvDefaultS'));
  if (!out.w.length) out.w.push(t('dvDefaultW'));
  if (!out.o.length) out.o.push(t('dvDefaultO'));
  if (!out.t.length) out.t.push(t('dvDefaultT'));
  return out;
}

/** First non-empty answer in a quadrant (or its free-text "More" field). */
export function firstAnswer(a: AnalysisRecord, k: 's' | 'w' | 'o' | 't'): string {
  return a[k].find(v => v) || (a as any)[k + 'More'] || '';
}
