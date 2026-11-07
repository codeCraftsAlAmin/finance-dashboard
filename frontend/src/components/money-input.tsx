"use client";

import { currencySymbol } from "@/lib/format";

/** A text field for amounts: shows the currency symbol and brings up the decimal keypad. */
export function MoneyInput({
  id,
  value,
  onChange,
  currency,
  required = true,
  placeholder = "0",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-ink-3">
        {currencySymbol(currency).trim()}
      </span>
      <input
        id={id}
        className="field num pl-8 text-right"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        required={required}
        pattern="[0-9,]*\.?[0-9]{0,2}"
        title="An amount such as 1500 or 1,500.50"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
