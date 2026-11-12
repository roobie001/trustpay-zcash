"use client";

import { ChevronDown } from "lucide-react";
import { DEFAULT_DIAL_CODE, DIAL_CODES, toE164 } from "@/lib/phone";
import { inputClass, labelClass } from "@/lib/ui";

/**
 * Dial-code selector + local number field with a live E.164 preview. The
 * parent owns both values; use `toE164(dialCode, value)` to get what to save.
 */
export function PhoneInput({
  id,
  label,
  dialCode,
  onDialCodeChange,
  value,
  onChange,
}: {
  id: string;
  label: string;
  dialCode: string;
  onDialCodeChange: (dial: string) => void;
  value: string;
  onChange: (value: string) => void;
}) {
  const e164 = toE164(dialCode, value);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <select
            aria-label="Country dial code"
            value={dialCode}
            onChange={(e) => onDialCodeChange(e.target.value)}
            className={`${inputClass} w-[6.75rem] cursor-pointer appearance-none pr-8 tabular-nums`}
          >
            {DIAL_CODES.map((c) => (
              <option key={c.iso} value={c.dial} title={c.name}>
                {c.iso} +{c.dial}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute inset-y-0 right-2.5 my-auto h-4 w-4 text-slate-400" />
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={dialCode === DEFAULT_DIAL_CODE.dial ? "801 234 5678" : "Phone number"}
          className={`${inputClass} min-w-0 flex-1 tabular-nums`}
        />
      </div>
      {value.trim() && (
        <p
          className={`mt-1.5 text-xs ${
            e164 ? "text-slate-500 dark:text-slate-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {e164 ? (
            <>
              Saved as <span className="font-mono">{e164}</span>
            </>
          ) : (
            "That doesn't look like a valid number for this country code."
          )}
        </p>
      )}
    </div>
  );
}
