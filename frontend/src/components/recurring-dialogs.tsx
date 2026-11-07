"use client";

import { useState, type FormEvent } from "react";
import { addMonths, formatDay, formatMoney, minorToInput, monthLabel, parseMoney } from "@/lib/format";
import {
  useCategories,
  useCreateRecurring,
  useSetPayment,
  useToday,
  useUpdateRecurring,
  useUser,
} from "@/lib/hooks";
import type { Kind, MonthCell, RecurringItem } from "@/lib/types";
import { MoneyInput } from "./money-input";
import { StatusChip } from "./status";
import { DialogActions, ErrorNote, Field, Modal } from "./ui";

/* --------------------------------------------------------------------------- add / edit */

export function RecurringDialog({
  open,
  onClose,
  kind,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  editing: RecurringItem | null;
}) {
  const title = editing ? "Edit monthly item" : kind === "income" ? "Add monthly income" : "Add a monthly bill";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={kind === "income" ? "Something you receive every month, like tuition." : "Something you pay every month, like wifi or a tutor fee."}
    >
      <Body onClose={onClose} kind={kind} editing={editing} />
    </Modal>
  );
}

function Body({ onClose, kind, editing }: { onClose: () => void; kind: Kind; editing: RecurringItem | null }) {
  const user = useUser();
  const today = useToday();
  const categories = useCategories();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amount_minor) : "");
  const [dueDay, setDueDay] = useState(String(editing?.due_day ?? Number(today.slice(8))));
  const [start, setStart] = useState(editing?.start_month ?? today.slice(0, 7));
  const [end, setEnd] = useState(editing?.end_month ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category ? String(editing.category.id) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [localError, setLocalError] = useState<Error | null>(null);

  const mutation = editing ? update : create;
  const options = (categories.data ?? []).filter((c) => c.kind === kind);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minor = parseMoney(amount);
    if (minor === null) return setLocalError(new Error("Enter an amount greater than zero."));
    if (end && end < start) return setLocalError(new Error("The last month can't be before the first month."));
    setLocalError(null);
    const input = {
      name: name.trim(),
      amount_minor: minor,
      due_day: Number(dueDay),
      start_month: start,
      end_month: end || null,
      category_id: categoryId ? Number(categoryId) : null,
      note: note.trim() || null,
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...input });
      else await create.mutateAsync({ kind, ...input });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <Field label="Name" htmlFor="rc-name">
        <input id="rc-name" className="field" value={name} maxLength={60} required placeholder={kind === "income" ? "Tuition" : "Wifi bill"} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount each month" htmlFor="rc-amount">
          <MoneyInput id="rc-amount" value={amount} onChange={setAmount} currency={user.currency} />
        </Field>
        <Field label={kind === "income" ? "Usually received on day" : "Due on day"} htmlFor="rc-due" hint="Short months use their last day.">
          <input id="rc-due" type="number" className="field" min={1} max={31} required value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="rc-start">
          <input id="rc-start" type="month" className="field" required value={start} max={addMonths(today.slice(0, 7), 12)} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Ends (optional)" htmlFor="rc-end" hint="Leave empty while it keeps going.">
          <input id="rc-end" type="month" className="field" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Category" htmlFor="rc-category">
        <select id="rc-category" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" htmlFor="rc-note">
        <input id="rc-note" className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNote error={localError ?? mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add item"}
        </button>
      </DialogActions>
    </form>
  );
}

/* ------------------------------------------------------------------------ month payment */

export function PaymentDialog({
  target,
  onClose,
}: {
  target: { item: RecurringItem; cell: MonthCell } | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target ? `${target.item.name} · ${monthLabel(target.cell.month, true)}` : ""}
    >
      {target && <PaymentBody target={target} onClose={onClose} />}
    </Modal>
  );
}

function PaymentBody({ target, onClose }: { target: { item: RecurringItem; cell: MonthCell }; onClose: () => void }) {
  const { item, cell } = target;
  const user = useUser();
  const today = useToday();
  const setPayment = useSetPayment();
  const paid = cell.status === "paid";
  const word = item.kind === "income" ? "received" : "paid";

  const [amount, setAmount] = useState(minorToInput(cell.amount_minor));
  const [day, setDay] = useState(cell.paid_on ?? today);
  const [localError, setLocalError] = useState<Error | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    const minor = parseMoney(amount);
    if (minor === null) return setLocalError(new Error("Enter an amount greater than zero."));
    setLocalError(null);
    try {
      await setPayment.mutateAsync({ id: item.id, month: cell.month, paid: true, paid_on: day, amount_minor: minor });
      onClose();
    } catch {
      // Shown below.
    }
  }

  async function undo() {
    try {
      await setPayment.mutateAsync({ id: item.id, month: cell.month, paid: false });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <StatusChip status={cell.status} kind={item.kind} />
        <span>
          Due {formatDay(cell.due_date, today)} · {formatMoney(item.amount_minor, user.currency)} a month
        </span>
      </div>
      {cell.status === "upcoming" ? (
        <p className="text-ink-2">This month hasn&rsquo;t started yet, so it can&rsquo;t be marked {word}.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Amount ${word}`} htmlFor="pay-amount">
              <MoneyInput id="pay-amount" value={amount} onChange={setAmount} currency={user.currency} />
            </Field>
            <Field label={`Date ${word}`} htmlFor="pay-date">
              <input id="pay-date" type="date" className="field" required value={day} max={today} onChange={(e) => setDay(e.target.value)} />
            </Field>
          </div>
          <p className="text-sm text-ink-3">
            This also adds a matching {item.kind} entry to Money, so your totals stay in step.
          </p>
        </>
      )}
      <ErrorNote error={localError ?? setPayment.error} />
      <DialogActions>
        {paid && (
          <button type="button" className="btn sm:mr-auto" onClick={undo} disabled={setPayment.isPending}>
            Mark as not {word}
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
        {cell.status !== "upcoming" && (
          <button type="submit" className="btn btn-primary" disabled={setPayment.isPending}>
            {setPayment.isPending ? "Saving…" : paid ? "Save changes" : `Mark as ${word}`}
          </button>
        )}
      </DialogActions>
    </form>
  );
}
