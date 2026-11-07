"use client";

import { useState, type FormEvent } from "react";
import { daysLabel, formatDay, monthShort } from "@/lib/format";
import { useCreateDate, useDates, useDeleteDate, useToday, useUpdateDate } from "@/lib/hooks";
import type { DateKind, ImportantDate } from "@/lib/types";
import { ColumnChart } from "../charts/bars";
import { PencilIcon, PlusIcon, TrashIcon } from "../icons";
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
} from "../ui";

const KINDS: { value: DateKind; label: string }[] = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" },
  { value: "memory", label: "Memory" },
  { value: "other", label: "Other" },
];
const kindLabel = (kind: DateKind) => KINDS.find((k) => k.value === kind)?.label ?? "Other";

function describeYears(item: ImportantDate) {
  if (item.years === null) return null;
  if (item.kind === "birthday") return `Turns ${item.years}`;
  return `${item.years} ${item.years === 1 ? "year" : "years"}`;
}

export function DatesPage() {
  const today = useToday();
  const dates = useDates();
  const [editing, setEditing] = useState<{ item: ImportantDate | null } | null>(null);
  const [deleting, setDeleting] = useState<ImportantDate | null>(null);
  const remove = useDeleteDate();

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const all = dates.data ?? [];
  const upcoming = all.filter((d) => !d.is_past);
  const past = all.filter((d) => d.is_past);
  const next = upcoming[0];

  // How many dates fall in each of the next 12 months.
  const start = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => {
    const [y, m] = start.split("-").map(Number);
    const index = y * 12 + (m - 1) + i;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
  const chart = months.map((month) => ({
    label: monthShort(month),
    title: `${monthShort(month)} ${month.slice(0, 4)}`,
    count: upcoming.filter((d) => d.next_date.startsWith(month)).length,
  }));

  return (
    <div className="fade-in">
      <PageHeader
        title="Dates to remember"
        lead="Birthdays, anniversaries, exams and moments worth remembering, with a countdown to each."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>
            <PlusIcon size={16} />
            Add a date
          </button>
        }
      />

      {dates.isPending ? (
        <Loading />
      ) : dates.isError ? (
        <LoadError error={dates.error} retry={() => dates.refetch()} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState
            title="No dates yet"
            body="Add a birthday, an anniversary or an exam. Yearly dates come back every year on their own."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>
                Add the first date
              </button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {next ? (
              <section className="panel p-4 sm:p-5">
                <p className="text-sm text-ink-2">Coming up next</p>
                <p className="num mt-1 text-5xl font-semibold leading-none">
                  {next.days_until === 0 ? "Today" : next.days_until}
                </p>
                {next.days_until > 0 && <p className="text-ink-2">{next.days_until === 1 ? "day to go" : "days to go"}</p>}
                <p className="mt-3 font-display text-xl font-semibold">{next.title}</p>
                <p className="text-sm text-ink-2">
                  {formatDay(next.next_date, today)} · {kindLabel(next.kind)}
                  {describeYears(next) ? ` · ${describeYears(next)}` : ""}
                </p>
              </section>
            ) : (
              <section className="panel p-4 sm:p-5">
                <p className="font-display text-lg font-semibold">Nothing coming up</p>
                <p className="mt-1 text-ink-2">All your dates are in the past. Add a new one to keep going.</p>
              </section>
            )}
            <Panel title="Dates in the next 12 months">
              <ColumnChart
                data={chart}
                series={[{ key: "count", name: "Dates", color: "var(--series-1)" }]}
                formatValue={(v) => `${v} ${v === 1 ? "date" : "dates"}`}
                formatTick={(v) => String(v)}
                tickInterval="preserveStartEnd"
                height={170}
                summary="How many remembered dates fall in each of the next twelve months."
                tableHead="Month"
              />
            </Panel>
          </div>

          <h2 className="mb-3 mt-6 font-display text-xl font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Panel>
              <EmptyState title="Nothing upcoming" body="Your remaining dates already happened." />
            </Panel>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((item) => (
                <DateCard key={item.id} item={item} today={today} onEdit={() => setEditing({ item })} onDelete={() => setDeleting(item)} />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 font-display text-xl font-semibold text-ink-2">Already happened</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((item) => (
                  <DateCard key={item.id} item={item} today={today} onEdit={() => setEditing({ item })} onDelete={() => setDeleting(item)} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <DateDialog
        key={editing ? `date-${editing.item?.id ?? "new"}` : "closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing?.item ?? null}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this date?"
        body={deleting && <><strong className="text-ink">{deleting.title}</strong> will be removed.</>}
        confirmLabel="Delete date"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DateCard({ item, today, onEdit, onDelete }: { item: ImportantDate; today: string; onEdit: () => void; onDelete: () => void }) {
  const soon = !item.is_past && item.days_until <= 7;
  const years = describeYears(item);
  return (
    <li className={`panel flex flex-col p-4 ${item.is_past ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Chip tone={soon ? "warn" : "neutral"}>{item.is_past ? "Past" : daysLabel(item.days_until)}</Chip>
        <span className="flex gap-1">
          <button type="button" className="btn btn-sm" aria-label={`Edit ${item.title}`} onClick={onEdit}>
            <PencilIcon size={15} />
          </button>
          <button type="button" className="btn btn-sm" aria-label={`Delete ${item.title}`} onClick={onDelete}>
            <TrashIcon size={15} />
          </button>
        </span>
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{item.title}</h3>
      <p className="text-sm text-ink-2">
        {formatDay(item.next_date, today)} · {kindLabel(item.kind)}
        {years ? ` · ${years}` : ""}
      </p>
      {item.repeat_yearly && <p className="mt-1 text-xs text-ink-3">Repeats every year</p>}
      {item.notes && <p className="mt-2 text-sm text-ink-2">{item.notes}</p>}
    </li>
  );
}

function DateDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: ImportantDate | null }) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit date" : "Add a date"}>
      <DateForm onClose={onClose} editing={editing} />
    </Modal>
  );
}

function DateForm({ onClose, editing }: { onClose: () => void; editing: ImportantDate | null }) {
  const today = useToday();
  const create = useCreateDate();
  const update = useUpdateDate();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [date, setDate] = useState(editing?.date ?? today);
  const [kind, setKind] = useState<DateKind>(editing?.kind ?? "birthday");
  const [yearly, setYearly] = useState(editing?.repeat_yearly ?? true);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const mutation = editing ? update : create;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { title: title.trim(), date, kind, repeat_yearly: yearly, notes: notes.trim() || null };
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
      <Field label="What is it?" htmlFor="dt-title">
        <input id="dt-title" className="field" required maxLength={100} placeholder="Mom's birthday" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="dt-date" hint={yearly ? "For birthdays, use the year you were born." : undefined}>
          <input id="dt-date" type="date" className="field" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Type" htmlFor="dt-kind">
          <select id="dt-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as DateKind)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-1 size-4" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
        <span>
          Repeat every year
          <span className="block text-sm text-ink-3">Turn off for one-time events like an exam or a deadline.</span>
        </span>
      </label>
      <Field label="Notes (optional)" htmlFor="dt-notes">
        <input id="dt-notes" className="field" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <ErrorNote error={mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add date"}
        </button>
      </DialogActions>
    </form>
  );
}
