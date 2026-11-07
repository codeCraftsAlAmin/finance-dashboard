"use client";

import { useState } from "react";
import { formatDay, formatMoney, monthLabel, monthOf, percent } from "@/lib/format";
import {
  useCategories,
  useDeleteTransaction,
  useToday,
  useTransactions,
  useTransactionSummary,
  useUser,
} from "@/lib/hooks";
import type { Kind, MonthKey, Transaction } from "@/lib/types";
import { CategoryDialog } from "../category-dialog";
import { ColumnChart } from "../charts/bars";
import { Donut } from "../charts/donut";
import { TrendChart } from "../charts/trend-chart";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../icons";
import { MonthSwitcher } from "../month-switcher";
import { TransactionDialog } from "../transaction-dialog";
import { ConfirmDialog, EmptyState, Loading, LoadError, PageHeader, Panel, Segmented, Swatch } from "../ui";
import { formatCompact } from "@/lib/format";

export function MoneyPage() {
  const user = useUser();
  const today = useToday();
  const current = monthOf(today);
  const [month, setMonth] = useState<MonthKey>(current);
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ editing: Transaction | null; kind: Kind } | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const summary = useTransactionSummary(month);
  const categories = useCategories();
  const transactions = useTransactions({
    month,
    kind: kind === "all" ? undefined : kind,
    category_id: categoryId ? Number(categoryId) : undefined,
    q: query.trim() || undefined,
  });
  const remove = useDeleteTransaction();

  const currency = user.currency;
  const s = summary.data;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const daily = (s?.daily ?? []).map((d) => ({
    label: String(Number(d.date.slice(8))),
    title: formatDay(d.date),
    expense_minor: d.expense_minor,
  }));
  const categoryOptions = (categories.data ?? []).filter((c) => kind === "all" || c.kind === kind);

  return (
    <div className="fade-in">
      <PageHeader
        title="Money"
        lead="Everything you earn and spend, by month."
        actions={
          <>
            <button type="button" className="btn" onClick={() => setCategoriesOpen(true)}>
              Categories
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ editing: null, kind: "expense" })}>
              <PlusIcon size={16} />
              Add entry
            </button>
          </>
        }
      />

      <div className="mb-4">
        <MonthSwitcher month={month} current={current} onChange={setMonth} />
      </div>

      {summary.isPending ? (
        <Loading />
      ) : summary.isError ? (
        <LoadError error={summary.error} retry={() => summary.refetch()} />
      ) : (
        s && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Income" value={formatMoney(s.income_minor, currency)} />
              <Stat label="Expenses" value={formatMoney(s.expense_minor, currency)} />
              <Stat
                label={s.balance_minor >= 0 ? "Left over" : "Overspent"}
                value={formatMoney(s.balance_minor, currency)}
                note={s.savings_rate === null ? undefined : `${percent(s.savings_rate)} of income kept`}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel title="Spending by category">
                {s.expense_by_category.length ? (
                  <Donut
                    slices={s.expense_by_category.map((c) => ({ name: c.name, color: c.color, value: c.amount_minor }))}
                    currency={currency}
                    centerLabel="spent"
                  />
                ) : (
                  <EmptyState title="No spending in this month" body="Expenses you add appear here, grouped by category." />
                )}
              </Panel>
              <Panel title="Spending by day">
                <ColumnChart
                  data={daily}
                  series={[{ key: "expense_minor", name: "Spent", color: "var(--series-2)" }]}
                  formatValue={(v) => formatMoney(v, currency)}
                  formatTick={(v) => formatCompact(v, currency)}
                  tickInterval={4}
                  summary={`Spending for each day of ${monthLabel(month, true)}.`}
                  tableHead="Day"
                />
              </Panel>
              <Panel title="Income and expenses" aside={<span className="text-sm text-ink-3">6 months to {monthLabel(month)}</span>}>
                <TrendChart data={s.trend} currency={currency} />
              </Panel>
              <Panel title="Income by source">
                {s.income_by_category.length ? (
                  <Donut
                    slices={s.income_by_category.map((c) => ({ name: c.name, color: c.color, value: c.amount_minor }))}
                    currency={currency}
                    centerLabel="earned"
                  />
                ) : (
                  <EmptyState title="No income in this month" body="Add tuition or other earnings to see where income comes from." />
                )}
              </Panel>
            </div>
          </>
        )
      )}

      <Panel title="Entries" className="mt-4" pad={false}>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-2 sm:px-5">
          <Segmented
            label="Filter by type"
            size="sm"
            value={kind}
            onChange={(next) => {
              setKind(next);
              setCategoryId("");
            }}
            options={[
              { value: "all", label: "All" },
              { value: "income", label: "Income" },
              { value: "expense", label: "Expenses" },
            ]}
          />
          <select aria-label="Filter by category" className="field !min-h-9 !w-auto !py-1 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative min-w-40 flex-1 sm:max-w-60">
            <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input aria-label="Search entries" className="field !min-h-9 !py-1 pl-9 text-sm" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {transactions.isPending ? (
          <Loading />
        ) : transactions.isError ? (
          <div className="p-4">
            <LoadError error={transactions.error} retry={() => transactions.refetch()} />
          </div>
        ) : transactions.data.length === 0 ? (
          <EmptyState
            title={query || categoryId || kind !== "all" ? "Nothing matches" : `No entries in ${monthLabel(month, true)}`}
            body={query || categoryId || kind !== "all" ? "Try clearing a filter." : "Add your first income or expense for this month."}
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setDialog({ editing: null, kind: "expense" })}>
                Add entry
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {transactions.data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="num w-14 shrink-0 text-sm text-ink-2">{formatDay(t.date, today)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.title}</p>
                  <p className="flex items-center gap-1.5 truncate text-sm text-ink-3">
                    <Swatch color={t.category?.color ?? "var(--ink-3)"} size={9} />
                    {t.category?.name ?? "Uncategorized"}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <span className="num whitespace-nowrap text-base font-semibold">
                  {formatMoney(t.kind === "income" ? t.amount_minor : -t.amount_minor, currency, { sign: true })}
                </span>
                <div className="flex shrink-0">
                  <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Edit ${t.title}`} onClick={() => setDialog({ editing: t, kind: t.kind })}>
                    <PencilIcon size={16} />
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost btn-icon" aria-label={`Delete ${t.title}`} onClick={() => setDeleting(t)}>
                    <TrashIcon size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <TransactionDialog
        key={dialog ? `${dialog.editing?.id ?? "new"}` : "closed"}
        open={dialog !== null}
        onClose={() => setDialog(null)}
        editing={dialog?.editing ?? null}
        defaultKind={dialog?.kind ?? "expense"}
      />
      <CategoryDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this entry?"
        body={
          deleting && (
            <>
              <strong className="text-ink">{deleting.title}</strong> ({formatMoney(deleting.amount_minor, currency)}) will be removed.
              If it was recorded from a monthly item, that month stays marked as paid. Un-mark it on the Monthly page instead.
            </>
          )
        }
        confirmLabel="Delete entry"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num text-3xl font-semibold leading-tight">{value}</p>
      {note && <p className="text-sm text-ink-3">{note}</p>}
    </div>
  );
}
