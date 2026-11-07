"use client";

import { useState, type FormEvent } from "react";
import { minorToInput, parseMoney } from "@/lib/format";
import { useCategories, useCreateTransaction, useToday, useUpdateTransaction, useUser } from "@/lib/hooks";
import type { Kind, Transaction } from "@/lib/types";
import { MoneyInput } from "./money-input";
import { DialogActions, ErrorNote, Field, Modal, Segmented } from "./ui";

export function TransactionDialog({
  open,
  onClose,
  editing,
  defaultKind = "expense",
}: {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  defaultKind?: Kind;
}) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit entry" : "Add an entry"}>
      <Body onClose={onClose} editing={editing} defaultKind={defaultKind} />
    </Modal>
  );
}

function Body({ onClose, editing, defaultKind }: { onClose: () => void; editing: Transaction | null; defaultKind: Kind }) {
  const user = useUser();
  const today = useToday();
  const categories = useCategories();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();

  const [kind, setKind] = useState<Kind>(editing?.kind ?? defaultKind);
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amount_minor) : "");
  const [date, setDate] = useState(editing?.date ?? today);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [categoryId, setCategoryId] = useState<string>(editing?.category ? String(editing.category.id) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [localError, setLocalError] = useState<Error | null>(null);

  const options = (categories.data ?? []).filter((c) => c.kind === kind);
  const mutation = editing ? update : create;

  function changeKind(next: Kind) {
    setKind(next);
    setCategoryId(""); // a category of the other kind no longer fits
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minor = parseMoney(amount);
    if (minor === null) {
      setLocalError(new Error("Enter an amount greater than zero, like 1500 or 1,500.50."));
      return;
    }
    setLocalError(null);
    const input = {
      kind,
      amount_minor: minor,
      date,
      title: title.trim(),
      note: note.trim() || null,
      category_id: categoryId ? Number(categoryId) : null,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...input });
      else await create.mutateAsync(input);
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <Segmented
        label="Type"
        value={kind}
        onChange={changeKind}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="tx-amount">
          <MoneyInput id="tx-amount" value={amount} onChange={setAmount} currency={user.currency} />
        </Field>
        <Field label="Date" htmlFor="tx-date">
          <input id="tx-date" type="date" className="field" value={date} max={today} required onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="What was it?" htmlFor="tx-title">
        <input
          id="tx-title"
          className="field"
          value={title}
          maxLength={80}
          required
          placeholder={kind === "income" ? "Tuition, November" : "Winter jacket"}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Category" htmlFor="tx-category">
        <select id="tx-category" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" htmlFor="tx-note">
        <input id="tx-note" className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNote error={localError ?? mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add entry"}
        </button>
      </DialogActions>
    </form>
  );
}
