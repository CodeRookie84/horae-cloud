/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SwotCompass.tsx — "Growth Compass" personal SWOT feature, ported from the
 * standalone SWOT Compass tool into a Horae dashboard tab.
 *
 * Faithful to the original flow (profile → questionnaire → auto-derived SWOT →
 * growth guide + career roadmap), with three changes:
 *   • no login — the signed-in Horae staff member is the user,
 *   • backend is Supabase (swotService), not the tool's /api,
 *   • theme matched to Horae (ink #162D4E + gold #C5A880), quadrant colours kept.
 *
 * Data tables live in swotData.ts (extracted verbatim); the engine in
 * swotEngine.ts. NOTE: Tailwind here is compile-time, so every class is a
 * literal — no dynamic `bg-${color}` (those would be purged from the build).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass, Sparkles, ArrowRight, ArrowLeft, Zap, Wrench, TrendingUp, ShieldAlert,
  Map as MapIcon, GraduationCap, Rocket, GitBranch, Briefcase, Flame, WandSparkles,
  Paperclip, Upload, FileCheck, RotateCcw, Download, Check, ShieldCheck, LifeBuoy,
  CalendarDays, BadgeCheck, UserRound, UserCog, Radar, NotebookPen, Globe, Loader2,
} from 'lucide-react';
import type { User as AppUser, Tenant } from '../../types';
import { LIKERT, TEXTS } from './swotData';
import {
  type Lang, type QState, type AnalysisRecord,
  tr, fmt, blankQ, deriveSWOT, firstAnswer, getBenchmark, detectRung,
} from './swotEngine';
import * as swotService from '../../services/swotService';

const INK = '#162D4E';
const GOLD = '#C5A880';
const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'हिंदी' },
  { code: 'kn', label: 'ಕನ್ನಡ' }, { code: 'bn', label: 'বাংলা' },
];
const STEPS = ['profile', 'work', 'stories', 'env'] as const;
const STEP_LABELS = ['stepProfile', 'stepWork', 'stepStories', 'stepEnv'];

// Per-quadrant literal class sets (no dynamic Tailwind classes).
const QUAD = {
  s: { icon: Zap,         title: 'stepStrengths',     tag: 'internalTag', top: 'border-t-emerald-500', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-700', bullet: 'text-emerald-500' },
  w: { icon: Wrench,      title: 'stepWeaknesses',    tag: 'internalTag', top: 'border-t-amber-500',   iconBg: 'bg-amber-100',   iconText: 'text-amber-600',   pill: 'bg-amber-100 text-amber-700',     bullet: 'text-amber-500' },
  o: { icon: TrendingUp,  title: 'stepOpportunities', tag: 'externalTag', top: 'border-t-indigo-500',  iconBg: 'bg-indigo-100',  iconText: 'text-indigo-600',  pill: 'bg-indigo-100 text-indigo-700',   bullet: 'text-indigo-500' },
  t: { icon: ShieldAlert, title: 'stepThreats',       tag: 'externalTag', top: 'border-t-rose-500',    iconBg: 'bg-rose-100',    iconText: 'text-rose-600',    pill: 'bg-rose-100 text-rose-700',       bullet: 'text-rose-500' },
} as const;

type QuadKey = keyof typeof QUAD;

interface SwotCompassProps {
  activeUser: AppUser;
  tenants?: Tenant[];
}

// ─── Small presentational helpers (module scope → no remount churn) ───────────
function QuadCard({ a, k, t }: { a: AnalysisRecord; k: QuadKey; t: (key: string) => string }) {
  const q = QUAD[k];
  const Icon = q.icon;
  const items = a[k].filter(Boolean);
  const more = (a as any)[k + 'More'];
  if (more) items.push(more);
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${q.top} shadow-sm p-5 flex flex-col`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <span className={`w-8 h-8 rounded-lg ${q.iconBg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${q.iconText}`} /></span>
          {t(q.title)}
        </h3>
        <span className={`text-[10px] uppercase tracking-wide font-bold rounded-full px-2 py-0.5 ${q.pill}`}>{t(q.tag)}</span>
      </div>
      <ul className="space-y-2 text-sm text-slate-600 flex-1">
        {items.length ? items.map((v, i) => (
          <li key={i} className="flex gap-2"><Check className={`w-4 h-4 ${q.bullet} shrink-0 mt-0.5`} /><span>{v}</span></li>
        )) : <li className="text-slate-400">{t('emptyAnswer')}</li>}
      </ul>
    </div>
  );
}

function GrowthGuide({ a, t }: { a: AnalysisRecord; t: (key: string) => string }) {
  const S = firstAnswer(a, 's'), W = firstAnswer(a, 'w'), O = firstAnswer(a, 'o'), T = firstAnswer(a, 't');
  const strategies = [
    { key: 'gSO', Icon: Rocket,      color: 'text-emerald-400', text: fmt(t('tplSO'), { s: S, o: O }) },
    { key: 'gWO', Icon: TrendingUp,  color: 'text-indigo-400',  text: fmt(t('tplWO'), { w: W, o: O }) },
    { key: 'gST', Icon: ShieldCheck, color: 'text-amber-400',   text: fmt(t('tplST'), { s: S, t: T }) },
    { key: 'gWT', Icon: LifeBuoy,    color: 'text-rose-400',    text: fmt(t('tplWT'), { w: W, t: T }) },
  ];
  return (
    <div className="mt-8 rounded-2xl p-6 sm:p-8 text-slate-100 shadow-xl" style={{ backgroundColor: INK }}>
      <h2 className="text-xl font-extrabold flex items-center gap-2.5 mb-6">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, #d9c4a3)` }}><Sparkles className="w-5 h-5 text-white" /></span>
        {t('growthTitle')}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {strategies.map(s => (
          <div key={s.key} className="bg-white/5 rounded-xl border border-white/10 p-4">
            <p className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2 ${s.color}`}><s.Icon className="w-3.5 h-3.5" />{t(s.key)}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" style={{ color: GOLD }} />{t('planTitle')}</p>
        <ol className="space-y-2">
          {['plan30', 'plan60', 'plan90'].map((k, i) => (
            <li key={k} className="flex gap-3 text-sm text-slate-300">
              <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: GOLD }}>{i + 1}</span>
              {t(k)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function RoadmapSection({ a, t }: { a: AnalysisRecord; t: (key: string) => string }) {
  const g = getBenchmark(a.role, a.industry);
  const here = detectRung(a.role, g.ladder);
  return (
    <div className="mt-8 print:hidden">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${INK}, ${GOLD})` }}><MapIcon className="w-5 h-5 text-white" /></span>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{t('roadmapTitle')}</h2>
          <p className="text-xs text-slate-400">{t('roadmapIntro')} · {a.role}, {a.industry}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-5 mt-5">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-emerald-600" />{t('upskillTitle')}</h3>
          <ul className="space-y-3.5">
            {g.grow.map((x: any, i: number) => (
              <li key={i}>
                <p className="text-sm font-semibold text-slate-800">{x.skill}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{x.why}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><GraduationCap className="w-4 h-4 text-indigo-600" />{t('coursesTitle')}</h3>
          <ul className="space-y-3">
            {g.courses.map((c: any, i: number) => (
              <li key={i} className="flex gap-2 text-sm">
                <BadgeCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span><span className="font-medium text-slate-800">{c.name}</span> <span className="text-xs text-slate-400">· {c.by}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-4 sm:mt-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><Rocket className="w-4 h-4 text-amber-600" />{t('nextLevelTitle')}</h3>
        <ol className="grid md:grid-cols-2 gap-x-6 gap-y-3">
          {g.levelUp.map((s: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-4 sm:mt-5">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><GitBranch className="w-4 h-4 text-indigo-600" />{t('successionTitle')}</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">{t('successionIntro')}</p>
        <ol className="space-y-0">
          {g.ladder.map((rung: any, i: number) => {
            const isHere = i === here, isNext = i === here + 1;
            return (
              <li key={i} className={`flex gap-3 sm:gap-4 ${i < g.ladder.length - 1 ? 'pb-4' : ''}`}>
                <div className="flex flex-col items-center">
                  <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${isHere ? 'text-white ring-4 ring-indigo-100 bg-indigo-600' : isNext ? 'bg-amber-100 text-amber-700 border-2 border-amber-400' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  {i < g.ladder.length - 1 && <span className={`w-0.5 flex-1 mt-1 ${i < here ? 'bg-indigo-200' : 'bg-slate-200'}`} />}
                </div>
                <div className="pb-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${isHere ? 'text-indigo-700' : 'text-slate-800'}`}>{rung.title}</p>
                    <span className="text-[11px] text-slate-400">{rung.years}</span>
                    {isHere && <span className="text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{t('youAreHereBadge')}</span>}
                    {isNext && <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{t('nextMoveLabel')}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed"><span className="font-medium text-slate-400">{t('focusLabel')}:</span> {rung.focus}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 sm:mt-5">
        <p className="text-[10px] uppercase tracking-wide font-bold text-amber-700 flex items-center gap-1.5 mb-2"><Briefcase className="w-3.5 h-3.5" />{t('caseStudyTitle')}</p>
        <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
          {g.caseStudies.map((cs: any, i: number) => (
            <div key={i} className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <h3 className="font-bold text-slate-900">{cs.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{cs.body}</p>
              <p className="text-xs font-semibold text-amber-900 mt-3 bg-amber-100/80 rounded-lg px-3 py-2"><span className="uppercase tracking-wide">{t('takeawayLabel')}:</span> {cs.takeaway}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 mt-4 sm:mt-5">
        <p className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 flex items-center gap-1.5 mb-2"><Flame className="w-3.5 h-3.5" />{t('storyTitle')}</p>
        <h3 className="font-bold text-slate-900">{g.story.title}</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{g.story.body}</p>
        <p className="text-sm italic text-emerald-800 mt-3 border-l-2 border-emerald-400 pl-3">“{g.story.quote}”</p>
      </div>
    </div>
  );
}

function AnalysisBody({ a, t }: { a: AnalysisRecord; t: (key: string) => string }) {
  return (
    <>
      {a.answers && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 mb-4"><WandSparkles className="w-3.5 h-3.5 shrink-0" />{t('derivedNote')}</p>
      )}
      {a.file && (
        <div className="flex items-center gap-2 text-sm text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6"><FileCheck className="w-4 h-4 shrink-0" />{fmt(t('attachedContext'), { file: a.file })}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <QuadCard a={a} k="s" t={t} /><QuadCard a={a} k="w" t={t} /><QuadCard a={a} k="o" t={t} /><QuadCard a={a} k="t" t={t} />
      </div>
      <GrowthGuide a={a} t={t} />
      <RoadmapSection a={a} t={t} />
    </>
  );
}

// ─── Questionnaire ────────────────────────────────────────────────────────────
function LikertRow({ item, n, value, onChange, t }: { item: any; n: number; value: number; onChange: (v: number) => void; t: (k: string) => string }) {
  return (
    <div className="py-4 border-b border-slate-100 last:border-0">
      <p className="text-sm font-medium text-slate-700 mb-3">{n}. {t(item.id)}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-slate-400">{t('scaleLow')}</span>
        <div className="flex gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5].map(x => (
            <button key={x} type="button" onClick={() => onChange(x)} aria-pressed={value === x}
              className={`w-9 h-9 rounded-full text-sm font-bold border transition-colors ${value === x ? 'text-white' : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'}`}
              style={value === x ? { backgroundColor: INK, borderColor: INK } : undefined}>{x}</button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400">{t('scaleHigh')}</span>
      </div>
    </div>
  );
}

function StoryBox({ item, n, value, onChange, t }: { item: any; n: number | null; value: string; onChange: (v: string) => void; t: (k: string) => string }) {
  return (
    <div className="mt-5">
      <label className="block text-sm font-medium text-slate-700 mb-1">{n ? n + '. ' : ''}{t(item.promptKey)}</label>
      <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={t('storyPlaceholder')}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#162D4E]/30 focus:border-[#162D4E] outline-none resize-y" />
    </div>
  );
}

function StepHeader({ Icon, tone, titleKey, introKey, tagKey, t }: { Icon: any; tone: 'emerald' | 'amber' | 'indigo'; titleKey: string; introKey: string; tagKey: string; t: (k: string) => string }) {
  const toneCls = tone === 'emerald' ? { bg: 'bg-emerald-100', text: 'text-emerald-600', pill: 'bg-emerald-100 text-emerald-700' }
    : tone === 'amber' ? { bg: 'bg-amber-100', text: 'text-amber-600', pill: 'bg-amber-100 text-amber-700' }
    : { bg: 'bg-indigo-100', text: 'text-indigo-600', pill: 'bg-indigo-100 text-indigo-700' };
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span className={`w-8 h-8 rounded-lg ${toneCls.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${toneCls.text}`} /></span>
          {t(titleKey)}
        </h2>
        <p className="text-sm text-slate-500 mt-1">{t(introKey)}</p>
      </div>
      <span className={`text-[10px] uppercase tracking-wide font-bold rounded-full px-2.5 py-1 shrink-0 ${toneCls.pill}`}>{t(tagKey)}</span>
    </div>
  );
}

function Questionnaire({ q, setQ, onSubmit, t, notify }: {
  q: QState; setQ: React.Dispatch<React.SetStateAction<QState>>;
  onSubmit: () => void; t: (k: string) => string; notify: (m: string) => void;
}) {
  const [saResult, setSaResult] = useState<any | null>(null);
  const [saLoading, setSaLoading] = useState(false);
  const stepId = STEPS[q.step];
  const total = STEPS.length;
  const pct = Math.round((q.step / (total - 1)) * 100);

  const validate = (): boolean => {
    if (stepId === 'profile') {
      if (!q.role.trim() || !q.industry.trim()) { notify(t('errProfile')); return false; }
    } else if (stepId === 'stories') {
      const any = (TEXTS as any[]).filter(x => x.step === 'stories').some(x => q.texts[x.id]?.trim());
      if (!any) { notify(t('errStories')); return false; }
    } else {
      const unanswered = (LIKERT as any[]).some(i => i.step === stepId && !q.likert[i.id]);
      if (unanswered) { notify(t('errLikert')); return false; }
    }
    return true;
  };

  const next = () => { if (!validate()) return; setQ(s => ({ ...s, step: s.step + 1 })); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const prev = () => setQ(s => ({ ...s, step: Math.max(0, s.step - 1) }));
  const submit = () => { if (!validate()) return; onSubmit(); };

  const runSmartAssist = () => {
    setSaLoading(true); setSaResult(null);
    setTimeout(() => { setSaResult(getBenchmark(q.role, q.industry)); setSaLoading(false); }, 900);
  };

  const workItems = (LIKERT as any[]).filter(i => i.step === 'work');
  const envItems = (LIKERT as any[]).filter(i => i.step === 'env');
  const futureItem = (TEXTS as any[]).find(x => x.id === 'future');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('qTitle')}</h1>
        <p className="text-sm text-slate-500 mt-1.5">{t('qIntro')}</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs font-medium text-slate-500 mb-2">
          <span>{fmt(t('stepOf'), { n: q.step + 1, total })}</span>
          <span className="font-semibold" style={{ color: INK }}>{t(STEP_LABELS[q.step])}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%`, background: `linear-gradient(90deg, ${INK}, ${GOLD})` }} />
        </div>
        <div className="hidden sm:flex justify-between mt-3">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-1.5 text-xs ${i <= q.step ? 'font-semibold' : 'text-slate-400'}`} style={i <= q.step ? { color: INK } : undefined}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: i < q.step ? '#10b981' : i === q.step ? INK : '#e2e8f0', color: i <= q.step ? '#fff' : '#64748b' }}>{i < q.step ? '✓' : i + 1}</span>
              {t(STEP_LABELS[i])}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/60 border border-slate-200 p-5 sm:p-8">
        {stepId === 'profile' && (
          <>
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><UserRound className="w-5 h-5" style={{ color: INK }} />{t('profileTitle')}</h2>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('roleLabel')}</label>
                <input type="text" value={q.role} onChange={e => setQ(s => ({ ...s, role: e.target.value }))} placeholder={t('rolePlaceholder')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#162D4E]/30 focus:border-[#162D4E] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('industryLabel')}</label>
                <input type="text" value={q.industry} onChange={e => setQ(s => ({ ...s, industry: e.target.value }))} placeholder={t('industryPlaceholder')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#162D4E]/30 focus:border-[#162D4E] outline-none" />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-700"><WandSparkles className="w-4 h-4" style={{ color: GOLD }} /><span>{t('smartAssistHint')}</span></div>
                <button onClick={runSmartAssist} className="flex items-center gap-1.5 text-white text-xs font-semibold rounded-lg px-3.5 py-2 transition-opacity hover:opacity-90" style={{ backgroundColor: INK }}>
                  <Sparkles className="w-3.5 h-3.5" /> {t('smartAssistBtn')}
                </button>
              </div>
              {saLoading && <div className="flex items-center gap-2 text-xs mt-3" style={{ color: INK }}><Loader2 className="w-4 h-4 animate-spin" />{t('smartAssistLoading')}</div>}
              {saResult && (
                <div className="mt-3 bg-white rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: INK }}>{t('smartAssistTitle')}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />{t('saSkills')}</p>
                      <ul className="space-y-1">{saResult.skills.map((s: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500 shrink-0">•</span>{s}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Radar className="w-3.5 h-3.5 text-indigo-600" />{t('saTrends')}</p>
                      <ul className="space-y-1">{saResult.trends.map((s: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-indigo-500 shrink-0">•</span>{s}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Paperclip className="w-4 h-4 text-slate-500" />{t('attachTitle')}</p>
              <p className="text-xs text-slate-500 mt-1">{t('attachHint')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg px-3.5 py-2 transition-colors">
                  <Upload className="w-3.5 h-3.5" /> {t('attachBtn')}
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.rtf" onChange={e => { const f = e.target.files?.[0]; if (f) setQ(s => ({ ...s, file: f.name })); }} />
                </label>
                {q.file && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full px-3 py-1.5"><FileCheck className="w-3.5 h-3.5" />{fmt(t('attachedMsg'), { file: q.file })}</span>
                )}
              </div>
            </div>
          </>
        )}

        {stepId === 'work' && (
          <>
            <StepHeader Icon={UserCog} tone="emerald" titleKey="stepWork" introKey="workIntro" tagKey="internalTag" t={t} />
            <div className="mt-4">
              {workItems.map((it, i) => (
                <LikertRow key={it.id} item={it} n={i + 1} value={q.likert[it.id]} t={t}
                  onChange={v => setQ(s => ({ ...s, likert: { ...s.likert, [it.id]: v } }))} />
              ))}
            </div>
          </>
        )}

        {stepId === 'stories' && (
          <>
            <StepHeader Icon={NotebookPen} tone="amber" titleKey="stepStories" introKey="storiesIntro" tagKey="internalTag" t={t} />
            {(TEXTS as any[]).filter(x => x.step === 'stories').map((x, i) => (
              <StoryBox key={x.id} item={x} n={i + 1} value={q.texts[x.id]} t={t}
                onChange={v => setQ(s => ({ ...s, texts: { ...s.texts, [x.id]: v } }))} />
            ))}
          </>
        )}

        {stepId === 'env' && (
          <>
            <StepHeader Icon={Radar} tone="indigo" titleKey="stepEnv" introKey="envIntro" tagKey="externalTag" t={t} />
            <div className="mt-4">
              {envItems.map((it, i) => (
                <LikertRow key={it.id} item={it} n={i + 1} value={q.likert[it.id]} t={t}
                  onChange={v => setQ(s => ({ ...s, likert: { ...s.likert, [it.id]: v } }))} />
              ))}
            </div>
            <StoryBox item={futureItem} n={null} value={q.texts[futureItem.id]} t={t}
              onChange={v => setQ(s => ({ ...s, texts: { ...s.texts, [futureItem.id]: v } }))} />
          </>
        )}

        <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
          <button onClick={prev} disabled={q.step === 0}
            className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-4 py-2.5 border transition-colors ${q.step === 0 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
            <ArrowLeft className="w-4 h-4" /> {t('prevBtn')}
          </button>
          {q.step < total - 1 ? (
            <button onClick={next} className="flex items-center gap-1.5 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-opacity hover:opacity-90" style={{ backgroundColor: INK }}>
              {t('nextBtn')} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={submit} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-5 py-2.5 transition-colors">
              <Sparkles className="w-4 h-4" /> {t('submitBtn')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main feature ─────────────────────────────────────────────────────────────
export default function SwotCompass({ activeUser, tenants = [] }: SwotCompassProps) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('swot_lang') as Lang) || 'en');
  const [view, setView] = useState<'loading' | 'questionnaire' | 'dashboard'>('loading');
  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [q, setQ] = useState<QState>(() => blankQ());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const t = useMemo(() => (k: string) => tr(lang, k), [lang]);
  const clientId = useMemo(() => tenants.find(tn => tn.id === activeUser.tenantId)?.clientId || tenants[0]?.clientId || null, [tenants, activeUser.tenantId]);

  const notify = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(cur => (cur === m ? null : cur)), 3200); };

  useEffect(() => { localStorage.setItem('swot_lang', lang); }, [lang]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const existing = await swotService.getMyAnalysis(activeUser.id);
      if (!alive) return;
      setAnalysis(existing);
      setView(existing ? 'dashboard' : 'questionnaire');
    })();
    return () => { alive = false; };
  }, [activeUser.id]);

  const startQuestionnaire = () => {
    const fresh = blankQ();
    // Prefill the role from the staff member's directory job title; industry blank.
    fresh.role = typeof activeUser.role === 'string' ? activeUser.role : '';
    if (analysis) {
      fresh.role = analysis.role || fresh.role;
      fresh.industry = analysis.industry || '';
      fresh.file = analysis.file || '';
      Object.assign(fresh.likert, analysis.answers?.likert || {});
      Object.assign(fresh.texts, analysis.answers?.texts || {});
    }
    setQ(fresh);
    setView('questionnaire');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    const derived = deriveSWOT(q, lang);
    const record: AnalysisRecord = {
      role: q.role.trim(), industry: q.industry.trim(), file: q.file,
      s: derived.s, w: derived.w, o: derived.o, t: derived.t,
      sMore: '', wMore: '', oMore: '', tMore: '',
      answers: { likert: { ...q.likert }, texts: { ...q.texts } },
    };
    const ok = await swotService.saveAnalysis(activeUser.id, activeUser.tenantId || null, clientId, record);
    if (!ok) { notify('Could not save. Please try again.'); return; }
    setAnalysis({ ...record, completedAt: new Date().toISOString() });
    setView('dashboard');
    notify(t('toastSaved'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const printPdf = () => {
    const prev = document.title;
    document.title = `${activeUser.name} - SWOT Analysis`.replace(/[\\/:*?"<>|]/g, '');
    window.print();
    document.title = prev;
  };

  return (
    <div className="h-full">
      {/* Print isolation: only the analysis prints, not the surrounding app chrome */}
      <style>{`@media print { body * { visibility: hidden !important; } #swot-print, #swot-print * { visibility: visible !important; } #swot-print { position: absolute; left: 0; top: 0; width: 100%; } .print\\:hidden { display: none !important; } }`}</style>

      {/* Feature header */}
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${INK}, ${GOLD})` }}><Compass className="w-5 h-5 text-white" /></div>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 leading-tight truncate">Growth Compass</p>
            <p className="text-[11px] text-slate-500 leading-tight truncate">{t('tagline')}</p>
          </div>
        </div>
        <div className="relative">
          <Globe className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label="Language"
            className="pl-8 pr-7 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-2 focus:ring-[#162D4E]/30 outline-none appearance-none cursor-pointer">
            {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {view === 'loading' && (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin" style={{ color: INK }} /></div>
      )}

      {view === 'questionnaire' && (
        <Questionnaire q={q} setQ={setQ} onSubmit={handleSubmit} t={t} notify={notify} />
      )}

      {view === 'dashboard' && analysis && (
        <div className="max-w-5xl mx-auto" id="swot-print">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('dashTitle')}</h1>
              <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-2"><Briefcase className="w-4 h-4" />{analysis.role} · {analysis.industry} · {activeUser.name}</p>
            </div>
            <div className="print:hidden flex flex-wrap gap-2">
              <button onClick={printPdf} className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-lg px-4 py-2 transition-colors"><Download className="w-4 h-4" />{t('downloadPdfBtn')}</button>
              <button onClick={startQuestionnaire} className="flex items-center gap-1.5 text-sm font-semibold border rounded-lg px-4 py-2 transition-colors hover:bg-slate-50" style={{ color: INK, borderColor: `${INK}55` }}><RotateCcw className="w-4 h-4" />{t('retakeBtn')}</button>
            </div>
          </div>
          <AnalysisBody a={analysis} t={t} />
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 bg-rose-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg max-w-sm print:hidden">{toastMsg}</div>
      )}
    </div>
  );
}
