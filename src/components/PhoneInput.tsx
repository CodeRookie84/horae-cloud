import React, { useEffect, useRef, useState } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, splitPhone, toPhoneDigits } from "../services/phone";

/**
 * Mobile number field with a country-code picker (defaults to +91).
 * Emits "+<code><number>" (e.g. "+971501234567"), or "" when the number is empty.
 * Pasting a full international number ("+44 7911 123456") switches the code.
 */
export function PhoneInput({ value, onChange, className = "", placeholder }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [code, setCode] = useState(() => (value ? splitPhone(value).code : DEFAULT_COUNTRY_CODE));
  const [national, setNational] = useState(() => (value ? splitPhone(value).national : ""));
  const lastEmitted = useRef(value);

  // Sync when the parent changes the value itself (form reset, opening another user).
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const s = value ? splitPhone(value) : { code: DEFAULT_COUNTRY_CODE, national: "" };
    setCode(s.code);
    setNational(s.national);
  }, [value]);

  const emit = (c: string, n: string) => {
    const v = n ? `+${c}${n}` : "";
    lastEmitted.current = v;
    onChange(v);
  };

  const onNumber = (raw: string) => {
    const t = raw.trim();
    // A full international number pasted in → take its country code from it.
    if (t.startsWith("+") || t.replace(/\D/g, "").startsWith("00")) {
      const d = toPhoneDigits(t);
      if (d) {
        const s = splitPhone(d);
        setCode(s.code); setNational(s.national); emit(s.code, s.national);
        return;
      }
    }
    let d = raw.replace(/\D/g, "");
    if (code === DEFAULT_COUNTRY_CODE) {
      // India: keep the 10-digit number (pastes like 919876543210 or 09876543210 work too)
      if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
      if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
      d = d.slice(0, 10);
    } else {
      if (d.startsWith(code) && d.length > code.length + 6) d = d.slice(code.length);
      d = d.replace(/^0+/, "").slice(0, 15 - code.length); // drop the local trunk "0"
    }
    setNational(d);
    emit(code, d);
  };

  const onCode = (c: string) => { setCode(c); emit(c, national); };

  // Keep an unknown stored code selectable instead of silently changing it.
  const options = COUNTRY_CODES.some(c => c.code === code) ? COUNTRY_CODES : [{ code, name: "Other" }, ...COUNTRY_CODES];

  return (
    <div className="flex gap-2">
      <select
        value={code}
        onChange={(e) => onCode(e.target.value)}
        aria-label="Country code"
        className={`${className} shrink-0 cursor-pointer`}
        style={{ width: "7.5rem" }}
      >
        {options.map(c => <option key={c.code} value={c.code}>+{c.code} {c.name}</option>)}
      </select>
      <input
        type="tel"
        inputMode="tel"
        placeholder={placeholder ?? (code === DEFAULT_COUNTRY_CODE ? "e.g., 9876543210" : "Mobile number")}
        value={national}
        onChange={(e) => onNumber(e.target.value)}
        className={`${className} min-w-0 flex-1`}
      />
    </div>
  );
}
