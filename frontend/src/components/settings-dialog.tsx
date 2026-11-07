"use client";

import { useState, type FormEvent } from "react";
import { useUpdateMe, useUser } from "@/lib/hooks";
import { browserTimeZone } from "@/lib/format";
import { DialogActions, ErrorNote, Field, Modal } from "./ui";

const CURRENCIES = [
  ["BDT", "৳ Bangladeshi taka"],
  ["USD", "$ US dollar"],
  ["EUR", "€ Euro"],
  ["GBP", "£ Pound sterling"],
  ["INR", "₹ Indian rupee"],
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Settings" description="How Khata shows your money and dates.">
      <Body onClose={onClose} />
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const user = useUser();
  const update = useUpdateMe();
  const [name, setName] = useState(user.name);
  const [currency, setCurrency] = useState(user.currency);
  const [timezone, setTimezone] = useState(user.timezone);
  const detected = browserTimeZone();

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim(), currency, timezone });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <Field label="Name" htmlFor="settings-name">
        <input id="settings-name" className="field" value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Currency" htmlFor="settings-currency" hint="Changes how amounts look. It doesn't convert anything.">
        <select id="settings-currency" className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Time zone" htmlFor="settings-tz" hint="Decides what counts as today and which month is running.">
        <input id="settings-tz" className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        {detected !== timezone && (
          <button type="button" className="mt-1 text-sm font-semibold underline underline-offset-4" onClick={() => setTimezone(detected)}>
            Use {detected}
          </button>
        )}
      </Field>
      <ErrorNote error={update.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save settings"}
        </button>
      </DialogActions>
    </form>
  );
}
