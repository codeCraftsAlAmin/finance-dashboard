"use client";

import { useState, type FormEvent } from "react";
import { addDays, challengeMonths, dayState, monthGrid, progressSeries } from "@/lib/challenge";
import { formatDay, monthLabel } from "@/lib/format";
import {
  useChallenges,
  useChallengeSummary,
  useCompleteChallenge,
  useCreateChallenge,
  useDeleteChallenge,
  useSetChallengeDay,
  useToday,
  useUpdateChallenge,
} from "@/lib/hooks";
import type { Challenge } from "@/lib/types";
import { ProgressChart } from "../charts/progress-chart";
import { CheckIcon, FlameIcon, PencilIcon, PlusIcon, TrashIcon, TrophyIcon } from "../icons";
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

const LENGTHS = [7, 14, 21, 30, 45, 60, 90];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ChallengesPage() {
  const today = useToday();
  const challenges = useChallenges();
  const summary = useChallengeSummary();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [claiming, setClaiming] = useState<Challenge | null>(null);
  const [deleting, setDeleting] = useState<Challenge | null>(null);
  const remove = useDeleteChallenge();

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const all = challenges.data ?? [];
  const running = all.filter((c) => c.state !== "completed");
  const achievements = all.filter((c) => c.state === "completed");
  const selected = running.find((c) => c.id === selectedId) ?? running[0];
  const s = summary.data;

  return (
    <div className="fade-in">
      <PageHeader
        title="Challenges"
        lead="Pick a skill, commit to it for 30 days and check in every day. Finished challenges move to your achievements."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon size={16} />
            New challenge
          </button>
        }
      />

      {challenges.isPending ? (
        <Loading />
      ) : challenges.isError ? (
        <LoadError error={challenges.error} retry={() => challenges.refetch()} />
      ) : (
        <>
          {s && all.length > 0 && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              <MiniStat label="Running" value={String(s.active_count)} />
              <MiniStat label="Achievements" value={String(s.completed_count)} />
              <MiniStat label="Best streak" value={`${s.best_streak} ${s.best_streak === 1 ? "day" : "days"}`} />
            </div>
          )}

          {running.length === 0 ? (
            <Panel>
              <EmptyState
                title={achievements.length ? "No challenge running" : "Start your first 30-day challenge"}
                body="Choose one skill, like Docker, touch typing or SQL, and work on it a little every day."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                    Start a challenge
                  </button>
                }
              />
            </Panel>
          ) : (
            <>
              {running.length > 1 && (
                <div className="mb-3">
                  <Segmented
                    label="Running challenges"
                    value={String(selected.id)}
                    onChange={(value) => setSelectedId(Number(value))}
                    options={running.map((c) => ({ value: String(c.id), label: c.title }))}
                  />
                </div>
              )}
              <ChallengeDetail
                key={selected.id}
                challenge={selected}
                today={today}
                onEdit={() => setEditing(selected)}
                onClaim={() => setClaiming(selected)}
                onDelete={() => setDeleting(selected)}
              />
            </>
          )}

          <section aria-label="Achievements" className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
              <TrophyIcon size={22} />
              Achievement box
              <span className="num text-sm font-normal text-ink-3">{achievements.length}</span>
            </h2>
            {achievements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-ink-3">
                Goals you complete are kept here. Claim a challenge when you are done, even before the deadline.
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {achievements.map((c) => (
                  <li key={c.id} className="panel flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid size-10 place-items-center rounded-xl bg-warn-soft text-warn">
                        <TrophyIcon size={22} />
                      </span>
                      <button type="button" className="btn btn-sm" aria-label={`Delete ${c.title}`} onClick={() => setDeleting(c)}>
                        <TrashIcon size={15} />
                      </button>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{c.title}</h3>
                    {c.outcome && <p className="mt-1 text-ink-2">{c.outcome}</p>}
                    {!c.outcome && c.goal && <p className="mt-1 text-ink-2">{c.goal}</p>}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                      <Chip tone="good" icon={<CheckIcon size={13} />}>
                        {c.completed_on ? formatDay(c.completed_on, today) : "Done"}
                      </Chip>
                      <Chip>
                        {c.days_done} of {c.duration_days} days
                      </Chip>
                      {c.completed_early && <Chip tone="good">{c.days_early} {c.days_early === 1 ? "day" : "days"} early</Chip>}
                      {c.best_streak > 1 && <Chip icon={<FlameIcon size={13} />}>{c.best_streak}-day streak</Chip>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => setSelectedId(id)} />
      <EditDialog key={editing ? `edit-${editing.id}` : "edit-none"} challenge={editing} onClose={() => setEditing(null)} />
      <ClaimDialog key={claiming ? `claim-${claiming.id}` : "claim-none"} challenge={claiming} today={today} onClose={() => setClaiming(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this challenge?"
        body={
          deleting && (
            <>
              <strong className="text-ink">{deleting.title}</strong> and its {deleting.days_done} check-ins will be removed
              {deleting.state === "completed" ? " from your achievements" : ""}. This can&apos;t be undone.
            </>
          )
        }
        confirmLabel="Delete challenge"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3 sm:p-4">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num mt-0.5 text-2xl font-semibold leading-tight">{value}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------- detail */

function ChallengeDetail({
  challenge,
  today,
  onEdit,
  onClaim,
  onDelete,
}: {
  challenge: Challenge;
  today: string;
  onEdit: () => void;
  onClaim: () => void;
  onDelete: () => void;
}) {
  const setDay = useSetChallengeDay();
  const c = challenge;
  const upcoming = c.state === "upcoming";
  const dayNumber = Math.min(c.days_elapsed, c.duration_days);
  const series = progressSeries(c, today);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold">{c.title}</h2>
              {c.state === "overdue" && <Chip tone="bad">Deadline passed</Chip>}
              {upcoming && <Chip>Starts {formatDay(c.start_date, today)}</Chip>}
              {c.state === "active" && <Chip tone={c.days_left <= 3 ? "warn" : "neutral"}>{c.days_left === 0 ? "Last day" : `${c.days_left} days left`}</Chip>}
            </div>
            {c.goal && <p className="mt-1 max-w-2xl text-ink-2">{c.goal}</p>}
            <p className="mt-1 text-sm text-ink-3">
              {formatDay(c.start_date, today)} to {formatDay(c.end_date, today)} · {c.duration_days} days
            </p>
          </div>
          <span className="flex gap-1">
            <button type="button" className="btn btn-sm" aria-label={`Edit ${c.title}`} onClick={onEdit}>
              <PencilIcon size={15} />
            </button>
            <button type="button" className="btn btn-sm" aria-label={`Delete ${c.title}`} onClick={onDelete}>
              <TrashIcon size={15} />
            </button>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Day" value={upcoming ? "–" : `${dayNumber} of ${c.duration_days}`} />
          <Fact label="Days done" value={`${c.days_done}`} note={`${c.percent}% of ${c.duration_days}`} />
          <Fact label="Streak" value={`${c.current_streak}`} note={c.best_streak > c.current_streak ? `Best ${c.best_streak}` : "days in a row"} icon={<FlameIcon size={16} />} />
          <Fact label="Missed" value={`${Math.max(0, c.days_elapsed - c.days_done)}`} note="so far" />
        </div>

        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
          role="progressbar"
          aria-label="Challenge progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={c.percent}
        >
          <div className="h-full rounded-full" style={{ width: `${c.percent}%`, background: "var(--series-1)" }} />
        </div>

        {c.state === "overdue" && (
          <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn">
            The {c.duration_days} days are over. Claim it if you finished, or delete it and start a new one.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {c.state === "active" && (
            <button
              type="button"
              className={`btn ${c.checked_today ? "" : "btn-primary"}`}
              disabled={setDay.isPending}
              aria-pressed={c.checked_today}
              onClick={() => setDay.mutate({ id: c.id, day: today, done: !c.checked_today })}
            >
              <CheckIcon size={16} />
              {c.checked_today ? "Done today (undo)" : "I did it today"}
            </button>
          )}
          <button type="button" className="btn" disabled={c.days_done === 0 || upcoming} onClick={onClaim}>
            <TrophyIcon size={16} />
            Claim as complete
          </button>
          {c.days_done === 0 && !upcoming && <span className="text-sm text-ink-3">Check in at least once to claim it.</span>}
        </div>
        {setDay.isError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{setDay.error.message}</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Panel title="Your progress">
          <ProgressChart data={series} total={c.duration_days} />
        </Panel>
        <Panel title="Day by day" aside={<span className="text-sm text-ink-3">Tap a day to mark it</span>}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {challengeMonths(c.start_date, c.end_date).map((month) => (
              <MonthGrid
                key={month}
                month={month}
                challenge={c}
                today={today}
                disabled={setDay.isPending}
                onToggle={(day, done) => setDay.mutate({ id: c.id, day, done })}
              />
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-[4px]" style={{ background: "var(--good)" }} /> Done</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-[4px] border border-dashed border-line-strong" /> Missed</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-[4px] ring-2 ring-ink" /> Today</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Fact({ label, value, note, icon }: { label: string; value: string; note?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-inset ring-line">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num flex items-center gap-1.5 text-2xl font-semibold leading-tight">
        {icon}
        {value}
      </p>
      {note && <p className="text-xs text-ink-3">{note}</p>}
    </div>
  );
}

function MonthGrid({
  month,
  challenge,
  today,
  disabled,
  onToggle,
}: {
  month: string;
  challenge: Challenge;
  today: string;
  disabled: boolean;
  onToggle: (day: string, done: boolean) => void;
}) {
  const weeks = monthGrid(month);
  return (
    <div>
      <h3 className="mb-2 font-display text-base font-semibold">{monthLabel(month, true)}</h3>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label={monthLabel(month, true)}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden="true" className="pb-1 text-center text-xs font-semibold text-ink-3">
            {d}
          </span>
        ))}
        {weeks.flat().map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const state = dayState(challenge, day, today);
          const number = Number(day.slice(8));
          const label = formatDay(day, today);
          if (state === "outside") {
            return (
              <span key={day} aria-hidden="true" className="num grid aspect-square place-items-center text-sm text-ink-3 opacity-40">
                {number}
              </span>
            );
          }
          const done = state === "done";
          const clickable = state !== "future";
          const cls =
            "num relative grid aspect-square place-items-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 " +
            (done
              ? `bg-good text-surface ${day === today ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`
              : state === "missed"
                ? "border border-dashed border-line-strong text-ink-3 hover:bg-surface-2"
                : state === "today"
                  ? "bg-surface-2 text-ink ring-2 ring-ink hover:bg-surface"
                  : "bg-surface-2 text-ink-3 opacity-60");
          return (
            <button
              key={day}
              type="button"
              className={cls}
              disabled={disabled || !clickable}
              aria-pressed={done}
              aria-label={`${label}${state === "today" ? ", today" : ""}${done ? ", done" : state === "missed" ? ", missed" : ""}`}
              onClick={() => onToggle(day, !done)}
            >
              {done ? <CheckIcon size={16} /> : number}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- dialogs */

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="New challenge">
      <CreateForm onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const today = useToday();
  const create = useCreateChallenge();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [start, setStart] = useState(today);
  const [length, setLength] = useState("30");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await create.mutateAsync({
        title: title.trim(),
        goal: goal.trim() || null,
        start_date: start,
        duration_days: Number(length),
      });
      onCreated(created.id);
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <Field label="What will you learn?" htmlFor="ch-title">
        <input id="ch-title" className="field" required maxLength={80} placeholder="Docker" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Your goal (optional)" htmlFor="ch-goal" hint="What you want to be able to do at the end.">
        <input id="ch-goal" className="field" maxLength={300} placeholder="Containerise and deploy my app" value={goal} onChange={(e) => setGoal(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts on" htmlFor="ch-start">
          <input id="ch-start" type="date" className="field" required value={start} min={addDays(today, -30)} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Length" htmlFor="ch-length">
          <select id="ch-length" className="field" value={length} onChange={(e) => setLength(e.target.value)}>
            {LENGTHS.map((n) => (
              <option key={n} value={n}>
                {n} days{n === 30 ? " (classic)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ErrorNote error={create.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? "Starting…" : "Start challenge"}
        </button>
      </DialogActions>
    </form>
  );
}

function EditDialog({ challenge, onClose }: { challenge: Challenge | null; onClose: () => void }) {
  return (
    <Modal open={challenge !== null} onClose={onClose} title="Edit challenge">
      {challenge && <EditForm challenge={challenge} onClose={onClose} />}
    </Modal>
  );
}

function EditForm({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const update = useUpdateChallenge();
  const [title, setTitle] = useState(challenge.title);
  const [goal, setGoal] = useState(challenge.goal ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await update.mutateAsync({ id: challenge.id, title: title.trim(), goal: goal.trim() || null });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <Field label="Skill" htmlFor="ce-title">
        <input id="ce-title" className="field" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Goal (optional)" htmlFor="ce-goal">
        <input id="ce-goal" className="field" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </Field>
      <ErrorNote error={update.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </DialogActions>
    </form>
  );
}

function ClaimDialog({ challenge, today, onClose }: { challenge: Challenge | null; today: string; onClose: () => void }) {
  return (
    <Modal open={challenge !== null} onClose={onClose} title="Claim as complete">
      {challenge && <ClaimForm challenge={challenge} today={today} onClose={onClose} />}
    </Modal>
  );
}

function ClaimForm({ challenge, today, onClose }: { challenge: Challenge; today: string; onClose: () => void }) {
  const complete = useCompleteChallenge();
  const [outcome, setOutcome] = useState("");
  const early = Math.max(0, Math.round((Date.parse(challenge.end_date) - Date.parse(today)) / 86_400_000));

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await complete.mutateAsync({ id: challenge.id, outcome: outcome.trim() || null });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-ink-2">
        <strong className="text-ink">{challenge.title}</strong> moves to your achievement box with {challenge.days_done} of{" "}
        {challenge.duration_days} days checked in
        {early > 0 ? `, ${early} ${early === 1 ? "day" : "days"} before the deadline` : ""}. You can&apos;t change the check-ins after that.
      </p>
      <Field label="What did you achieve? (optional)" htmlFor="cc-outcome">
        <input id="cc-outcome" className="field" maxLength={300} placeholder="Deployed my app with Docker" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </Field>
      <ErrorNote error={complete.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Not yet
        </button>
        <button type="submit" className="btn btn-primary" disabled={complete.isPending}>
          {complete.isPending ? "Saving…" : "Claim it"}
        </button>
      </DialogActions>
    </form>
  );
}
