"use client";

import { useState } from "react";
import { formatCompact, formatMoney, monthLabel, monthShort } from "@/lib/format";
import { useBoard, useDeleteRecurring, useUser } from "@/lib/hooks";
import type { Board, Kind, MonthCell, RecurringItem } from "@/lib/types";
import { ColumnChart } from "../charts/bars";
import { AlertIcon, CheckIcon, ClockIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
import { PaymentDialog, RecurringDialog } from "../recurring-dialogs";
import { ConfirmDialog, EmptyState, Loading, LoadError, PageHeader, Panel, Segmented } from "../ui";

export function BillsPage() {
  const [kind, setKind] = useState<Kind>("expense");
  const board = useBoard(kind);
  const user = useUser();
  const [editing, setEditing] = useState<{ item: RecurringItem | null } | null>(null);
  const [paying, setPaying] = useState<{ item: RecurringItem; cell: MonthCell } | null>(null);
  const [deleting, setDeleting] = useState<RecurringItem | null>(null);
  const remove = useDeleteRecurring();
  const expense = kind === "expense";

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Monthly"
        lead="Tuition you earn and bills you pay, with every month marked paid or still open."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>
            <PlusIcon size={16} />
            {expense ? "Add a bill" : "Add income"}
          </button>
        }
      />

      <div className="mb-4">
        <Segmented
          label="Kind of monthly item"
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: "Bills I pay" },
            { value: "income", label: "Income I receive" },
          ]}
        />
      </div>

      {board.isPending ? (
        <Loading />
      ) : board.isError ? (
        <LoadError error={board.error} retry={() => board.refetch()} />
      ) : board.data.rows.length === 0 ? (
        <Panel>
          <EmptyState
            title={expense ? "No monthly bills yet" : "No monthly income yet"}
            body={
              expense
                ? "Add the wifi bill, a tutor fee or rent once. Then tick off each month as you pay it."
                : "Add your tuition once, then mark each month as received when the money arrives."
            }
            action={
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ item: null })}>
                {expense ? "Add your first bill" : "Add your tuition"}
              </button>
            }
          />
        </Panel>
      ) : (
        <BoardView board={board.data} kind={kind} currency={user.currency} onPick={(item, cell) => setPaying({ item, cell })} onEdit={(item) => setEditing({ item })} onDelete={setDeleting} />
      )}

      <RecurringDialog
        key={editing ? `${editing.item?.id ?? "new"}-${kind}` : "closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        kind={kind}
        editing={editing?.item ?? null}
      />
      <PaymentDialog key={paying ? `${paying.item.id}-${paying.cell.month}` : "none"} target={paying} onClose={() => setPaying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this monthly item?"
        body={
          deleting && (
            <>
              <strong className="text-ink">{deleting.name}</strong> and its month-by-month history will be removed. Entries already
              added to Money stay.
            </>
          )
        }
        confirmLabel="Delete item"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function BoardView({
  board,
  kind,
  currency,
  onPick,
  onEdit,
  onDelete,
}: {
  board: Board;
  kind: Kind;
  currency: string;
  onPick: (item: RecurringItem, cell: MonthCell) => void;
  onEdit: (item: RecurringItem) => void;
  onDelete: (item: RecurringItem) => void;
}) {
  const expense = kind === "expense";
  const doneWord = expense ? "Paid" : "Received";

  // This month at a glance.
  const nowCells = board.rows.flatMap((row) => row.cells.filter((c) => c.is_current));
  const total = nowCells.reduce((sum, c) => sum + c.amount_minor, 0);
  const done = nowCells.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amount_minor, 0);
  const share = total ? done / total : 0;

  // Paid vs still open, per month, across every item.
  const chart = board.months.map((month) => {
    const cells = board.rows.flatMap((row) => row.cells.filter((c) => c.month === month));
    return {
      label: monthShort(month),
      title: monthLabel(month, true),
      paid: cells.filter((c) => c.status === "paid").reduce((s, c) => s + c.amount_minor, 0),
      open: cells.filter((c) => c.status !== "paid").reduce((s, c) => s + c.amount_minor, 0),
    };
  });

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="panel p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">{monthLabel(board.current_month, true)}</h2>
          <p className="mt-3 text-sm text-ink-2">{expense ? "Paid so far" : "Received so far"}</p>
          <p className="num text-4xl font-semibold leading-tight">
            {formatMoney(done, currency)}
            <span className="text-xl text-ink-3"> / {formatMoney(total, currency)}</span>
          </p>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
            role="progressbar"
            aria-label={expense ? "Share of this month's bills paid" : "Share of this month's income received"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(share * 100)}
          >
            <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: "var(--series-1)" }} />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            {total - done > 0 ? `${formatMoney(total - done, currency)} ${expense ? "still to pay" : "still expected"}.` : "Everything is settled for this month."}
          </p>
        </section>
        <Panel title={expense ? "Paid and still open" : "Received and still expected"}>
          <ColumnChart
            data={chart}
            stacked
            series={[
              { key: "paid", name: doneWord, color: "var(--series-1)" },
              { key: "open", name: expense ? "Still open" : "Not received", color: "var(--series-2)" },
            ]}
            formatValue={(v) => formatMoney(v, currency)}
            formatTick={(v) => formatCompact(v, currency)}
            height={170}
            summary={`${doneWord} and still-open totals for each of the last ${board.months.length} months.`}
            tableHead="Month"
          />
        </Panel>
      </div>

      <Panel title="Month by month" className="mt-4" pad={false} aside={<span className="mr-1 text-sm text-ink-3 sm:mr-2">Select a month to update it</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="text-sm text-ink-2">
                <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-2 font-semibold sm:px-5">
                  Item
                </th>
                {board.months.map((month) => (
                  <th key={month} scope="col" className="px-1.5 py-2 text-center font-semibold">
                    <span className="block">{monthLabel(month)}</span>
                    {month === board.current_month && <span className="text-xs font-semibold text-ink">Running</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr key={row.item.id} className="border-t border-line">
                  <th scope="row" className="sticky left-0 z-10 min-w-44 bg-surface px-4 py-3 text-left align-middle sm:px-5">
                    <p className="font-semibold">{row.item.name}</p>
                    <p className="text-sm font-normal text-ink-3">
                      {formatMoney(row.item.amount_minor, currency)} · day {row.item.due_day}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <button type="button" className="btn btn-sm btn-ghost btn-icon !min-h-8 !min-w-8" aria-label={`Edit ${row.item.name}`} onClick={() => onEdit(row.item)}>
                        <PencilIcon size={15} />
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost btn-icon !min-h-8 !min-w-8" aria-label={`Delete ${row.item.name}`} onClick={() => onDelete(row.item)}>
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </th>
                  {board.months.map((month) => {
                    const cell = row.cells.find((c) => c.month === month);
                    return (
                      <td key={month} className={`px-1.5 py-2 text-center align-middle ${month === board.current_month ? "bg-surface-2" : ""}`}>
                        {cell ? <CellButton item={row.item} cell={cell} currency={currency} kind={kind} onPick={onPick} /> : <span className="text-ink-3" aria-label="Not active">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-sm text-ink-2 sm:px-5">
          {board.rows.map((row) => (
            <span key={row.item.id}>
              <strong className="text-ink">{row.item.name}:</strong> {row.paid_count} {doneWord.toLowerCase()}, {row.unpaid_count} open
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}

function CellButton({
  item,
  cell,
  currency,
  kind,
  onPick,
}: {
  item: RecurringItem;
  cell: MonthCell;
  currency: string;
  kind: Kind;
  onPick: (item: RecurringItem, cell: MonthCell) => void;
}) {
  const expense = kind === "expense";
  const label = {
    paid: expense ? "Paid" : "Received",
    overdue: "Overdue",
    due: expense ? "Due" : "Expected",
    upcoming: "Upcoming",
  }[cell.status];
  const tone =
    cell.status === "paid"
      ? "bg-good-soft text-good"
      : cell.status === "overdue"
        ? "bg-danger-soft text-danger"
        : cell.status === "due"
          ? "bg-warn-soft text-warn"
          : "bg-surface-2 text-ink-3 ring-1 ring-inset ring-line";
  const Icon = cell.status === "paid" ? CheckIcon : cell.status === "overdue" ? AlertIcon : ClockIcon;
  return (
    <button
      type="button"
      onClick={() => onPick(item, cell)}
      aria-label={`${item.name}, ${monthLabel(cell.month, true)}: ${label}, ${formatMoney(cell.amount_minor, currency)}`}
      className={`mx-auto flex min-h-12 w-full min-w-[4.6rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold leading-tight transition-transform hover:scale-[1.03] ${tone}`}
    >
      <span className="flex items-center gap-1">
        <Icon size={13} />
        {label}
      </span>
      <span className="num text-[0.7rem] font-medium opacity-90">{formatCompact(cell.amount_minor, currency)}</span>
    </button>
  );
}

