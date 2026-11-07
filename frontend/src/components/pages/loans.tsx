"use client";

import { useState, type FormEvent } from "react";
import { formatCompact, formatDay, formatMoney, minorToInput, parseMoney } from "@/lib/format";
import {
  useAddLoanPayment,
  useCreateLoan,
  useDeleteLoan,
  useDeleteLoanPayment,
  useLoans,
  useLoanSummary,
  useToday,
  useUpdateLoan,
  useUser,
} from "@/lib/hooks";
import type { Direction, Loan } from "@/lib/types";
import { BalanceBars } from "../charts/bars";
import { AlertIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { MoneyInput } from "../money-input";
import {
  Chip,
  ConfirmDialog,
  DialogActions,
  EmptyState,
  ErrorNote,
  Field,
  Loading,
  LoadError,
  Modal,
  PageHeader,
  Panel,
  Segmented,
} from "../ui";

type Filter = "open" | "settled" | "all";

export function LoansPage() {
  const user = useUser();
  const today = useToday();
  const loans = useLoans();
  const summary = useLoanSummary();
  const [filter, setFilter] = useState<Filter>("open");
  const [editing, setEditing] = useState<{ loan: Loan | null } | null>(null);
  const [paying, setPaying] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState<Loan | null>(null);
  const remove = useDeleteLoan();
  const currency = user.currency;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const all = loans.data ?? [];
  const shown = all.filter((l) => (filter === "all" ? true : filter === "open" ? !l.settled : l.settled));
  const s = summary.data;

  return (
    <div className="fade-in">
      <PageHeader
        title="Lend & borrow"
        lead="Who owes you, who you owe, and what is still left after repayments."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ loan: null })}>
            <PlusIcon size={16} />
            Add a record
          </button>
        }
      />

      {loans.isPending || summary.isPending ? (
        <Loading />
      ) : loans.isError ? (
        <LoadError error={loans.error} retry={() => loans.refetch()} />
      ) : summary.isError ? (
        <LoadError error={summary.error} retry={() => summary.refetch()} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing lent or borrowed yet"
            body="Record money you give to or take from someone, then log repayments as they come in."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ loan: null })}>
                Add the first record
              </button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Owed to you" value={formatMoney(s!.lent_outstanding_minor, currency)} note="Money you lent, still out" />
            <Stat label="You owe" value={formatMoney(s!.borrowed_outstanding_minor, currency)} note="Money you borrowed, still unpaid" />
            <Stat
              label="Net position"
              value={formatMoney(s!.net_minor, currency, { sign: true })}
              note={s!.net_minor >= 0 ? "In your favour overall" : "You owe more than you are owed"}
            />
          </div>

          {s!.people.length > 0 && (
            <Panel title="Balance by person" className="mt-4">
              <BalanceBars
                data={s!.people.map((p) => ({ name: p.person, value: p.net_minor }))}
                formatValue={(v) => formatMoney(v, currency, { sign: true })}
                formatTick={(v) => formatCompact(v, currency)}
                positiveLabel="They owe you"
                negativeLabel="You owe them"
              />
            </Panel>
          )}

          <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Records</h2>
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "open", label: "Open", count: s!.open_count },
                { value: "settled", label: "Settled", count: s!.settled_count },
                { value: "all", label: "All", count: all.length },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <Panel>
              <EmptyState title={filter === "open" ? "All settled" : "Nothing here"} body="No records match this view." />
            </Panel>
          ) : (
            <ul className="space-y-3">
              {shown.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  currency={currency}
                  today={today}
                  onPay={() => setPaying(loan)}
                  onEdit={() => setEditing({ loan })}
                  onDelete={() => setDeleting(loan)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <LoanDialog
        key={editing ? `loan-${editing.loan?.id ?? "new"}` : "closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing?.loan ?? null}
      />
      <RepaymentDialog key={paying ? `pay-${paying.id}` : "none"} loan={paying} onClose={() => setPaying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this record?"
        body={
          deleting && (
            <>
              The record with <strong className="text-ink">{deleting.person}</strong> and its repayments will be removed.
            </>
          )
        }
        confirmLabel="Delete record"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num mt-1 text-3xl font-semibold leading-tight">{value}</p>
      <p className="mt-1 text-sm text-ink-3">{note}</p>
    </div>
  );
}

function LoanCard({
  loan,
  currency,
  today,
  onPay,
  onEdit,
  onDelete,
}: {
  loan: Loan;
  currency: string;
  today: string;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lent = loan.direction === "lent";
  const share = loan.amount_minor ? loan.paid_minor / loan.amount_minor : 0;
  const removePayment = useDeleteLoanPayment();
  const [open, setOpen] = useState(false);

  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{loan.person}</h3>
            <Chip tone={lent ? "good" : "warn"}>{lent ? "You lent" : "You borrowed"}</Chip>
            {loan.settled && (
              <Chip tone="good" icon={<CheckIcon size={13} />}>
                Settled
              </Chip>
            )}
            {loan.overdue && (
              <Chip tone="bad" icon={<AlertIcon size={13} />}>
                Overdue
              </Chip>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-2">
            {formatDay(loan.date, today)}
            {loan.reason ? ` · ${loan.reason}` : ""}
            {loan.due_date && !loan.settled ? ` · due ${formatDay(loan.due_date, today)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-semibold leading-tight">{formatMoney(loan.remaining_minor, currency)}</p>
          <p className="text-sm text-ink-3">left of {formatMoney(loan.amount_minor, currency)}</p>
        </div>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
        role="progressbar"
        aria-label={`Repaid ${Math.round(share * 100)} percent`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
      >
        <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: "var(--series-1)" }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!loan.settled && (
          <button type="button" className="btn btn-sm btn-primary" onClick={onPay}>
            {lent ? "Record repayment received" : "Record repayment made"}
          </button>
        )}
        {loan.payments.length > 0 && (
          <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Show"} repayments ({loan.payments.length})
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <button type="button" className="btn btn-sm" aria-label={`Edit record with ${loan.person}`} onClick={onEdit}>
            <PencilIcon size={15} />
          </button>
          <button type="button" className="btn btn-sm" aria-label={`Delete record with ${loan.person}`} onClick={onDelete}>
            <TrashIcon size={15} />
          </button>
        </span>
      </div>

      {open && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {loan.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="text-ink-2">{formatDay(p.date, today)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-3">{p.note}</span>
              <span className="num font-semibold">{formatMoney(p.amount_minor, currency)}</span>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Remove repayment of ${formatMoney(p.amount_minor, currency)}`}
                disabled={removePayment.isPending}
                onClick={() => removePayment.mutate({ id: loan.id, paymentId: p.id })}
              >
                <TrashIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {removePayment.isError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{removePayment.error.message}</p>}
    </li>
  );
}

/* ------------------------------------------------------------------------------ dialogs */

function LoanDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Loan | null }) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit record" : "Add a record"}>
      <LoanForm onClose={onClose} editing={editing} />
    </Modal>
  );
}

function LoanForm({ onClose, editing }: { onClose: () => void; editing: Loan | null }) {
  const user = useUser();
  const today = useToday();
  const create = useCreateLoan();
  const update = useUpdateLoan();
  const [direction, setDirection] = useState<Direction>(editing?.direction ?? "lent");
  const [person, setPerson] = useState(editing?.person ?? "");
  const [amount, setAmount] = useState(editing ? minorToInput(editing.amount_minor) : "");
  const [date, setDate] = useState(editing?.date ?? today);
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [due, setDue] = useState(editing?.due_date ?? "");
  const [localError, setLocalError] = useState<Error | null>(null);
  const mutation = editing ? update : create;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minor = parseMoney(amount);
    if (minor === null) return setLocalError(new Error("Enter an amount greater than zero."));
    if (due && due < date) return setLocalError(new Error("The due date can't be before the date of the loan."));
    if (editing && minor < editing.paid_minor)
      return setLocalError(new Error("The amount can't be less than what has already been repaid."));
    setLocalError(null);
    const input = {
      person: person.trim(),
      direction,
      amount_minor: minor,
      date,
      reason: reason.trim() || null,
      due_date: due || null,
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
        label="Direction"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "lent", label: "I lent money" },
          { value: "borrowed", label: "I borrowed money" },
        ]}
      />
      <Field label={direction === "lent" ? "Who did you lend to?" : "Who did you borrow from?"} htmlFor="ln-person">
        <input id="ln-person" className="field" required maxLength={60} value={person} onChange={(e) => setPerson(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="ln-amount">
          <MoneyInput id="ln-amount" value={amount} onChange={setAmount} currency={user.currency} />
        </Field>
        <Field label="Date" htmlFor="ln-date">
          <input id="ln-date" type="date" className="field" required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Reason (optional)" htmlFor="ln-reason">
        <input id="ln-reason" className="field" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label="Expected back by (optional)" htmlFor="ln-due">
        <input id="ln-due" type="date" className="field" value={due} min={date} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <ErrorNote error={localError ?? mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add record"}
        </button>
      </DialogActions>
    </form>
  );
}

function RepaymentDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  return (
    <Modal open={loan !== null} onClose={onClose} title="Record a repayment">
      {loan && <RepaymentForm loan={loan} onClose={onClose} />}
    </Modal>
  );
}

function RepaymentForm({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const user = useUser();
  const today = useToday();
  const add = useAddLoanPayment();
  const [amount, setAmount] = useState(minorToInput(loan.remaining_minor));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState<Error | null>(null);
  const lent = loan.direction === "lent";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minor = parseMoney(amount);
    if (minor === null) return setLocalError(new Error("Enter an amount greater than zero."));
    if (minor > loan.remaining_minor)
      return setLocalError(new Error(`Only ${formatMoney(loan.remaining_minor, user.currency)} is still owed.`));
    setLocalError(null);
    try {
      await add.mutateAsync({ id: loan.id, date, amount_minor: minor, note: note.trim() || null });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-ink-2">
        {lent ? `${loan.person} pays you back` : `You pay ${loan.person} back`}. {formatMoney(loan.remaining_minor, user.currency)} is
        still owed.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="rp-amount">
          <MoneyInput id="rp-amount" value={amount} onChange={setAmount} currency={user.currency} />
        </Field>
        <Field label="Date" htmlFor="rp-date">
          <input id="rp-date" type="date" className="field" required value={date} max={today} min={loan.date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Note (optional)" htmlFor="rp-note">
        <input id="rp-note" className="field" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNote error={localError ?? add.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={add.isPending}>
          {add.isPending ? "Saving…" : "Save repayment"}
        </button>
      </DialogActions>
    </form>
  );
}
