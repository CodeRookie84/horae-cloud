import React, { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { GOOGLE_TRANSLATE_LANGUAGES, languageByCode } from "../services/languages";

/**
 * Searchable multi-select over the full Google Translate language list. Used at
 * client onboarding / edit to choose which languages that client's staff can
 * translate into. Selected codes are shown as removable chips.
 */
export default function LanguageMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (codes: string[]) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GOOGLE_TRANSLATE_LANGUAGES;
    return GOOGLE_TRANSLATE_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [query]);

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  return (
    <div className="space-y-2">
      <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
        Translation Languages {value.length > 0 && `(${value.length} selected)`}
      </label>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => {
            const l = languageByCode(code);
            return (
              <button
                type="button"
                key={code}
                onClick={() => toggle(code)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-semibold hover:bg-blue-100 transition-colors"
              >
                {l ? l.native : code}
                <X className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search languages…"
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Options list */}
      <div className="max-h-52 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
        {filtered.map((l) => {
          const selected = value.includes(l.code);
          return (
            <button
              type="button"
              key={l.code}
              onClick={() => toggle(l.code)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                selected ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <span>
                <span className="font-semibold text-slate-700">{l.native}</span>
                <span className="text-slate-400 ml-2">{l.name}</span>
              </span>
              {selected && <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.5} />}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-[11px] text-slate-400">No languages match "{query}".</p>
        )}
      </div>
    </div>
  );
}
