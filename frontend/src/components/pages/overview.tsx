"use client";

import Link from "next/link";
import { daysLabel, formatDay, formatMoney, monthLabel, percent } from "@/lib/format";
import { useOverview, useSetPayment, useUser } from "@/lib/hooks";
import type { Overview } from "@/lib/types";
import { Donut } from "../charts/donut";
import { TrendChart } from "../charts/trend-chart";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from "../icons";
import { StatusChip } from "../status";
import { Chip, EmptyState, Loading, LoadError, PageHeader, Panel, Swatch } from "../ui";

export function OverviewPage() {
  const user = useUser();
  const overview = useOverview();
  if (overview.isPending) return <Loading />;
  if (overview.isError) return <LoadError error={overview.error} retry={() => overview.refetch()} />;
  const data = overview.data;

  return (
    <div className="fade-in">
      <PageHeader title="Overview" lead={`${monthLabel(data.month, true)}, in one page.`} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Statement data={data} currency={user.currency} />
        <Panel title="Income and expenses" aside={<span className="text-sm text-ink-3">Last 6 months</span>}>
          <TrendChart data={data.trend} currency={user.currency} height={230} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Where it went"
          aside={<Link href="/money" className="text-sm font-semibold underline underline-offset-4">All spending</Link>}
        >
          {data.expense_by_category.length ? (
            <Donut
              slices={data.expense_by_category.map((c) => ({ name: c.name, color: c.color, value: c.amount_minor }))}
              currency={user.currency}
              centerLabel="spent"
            />
          ) : (
            <EmptyState title="Nothing spent yet" body="Add an expense and its share of the month shows up here." />
          )}
        </Panel>
        <MonthlyChecklist data={data} currency={user.currency} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Dates data={data} />
        <Loans data={data} currency={user.currency} />
        <Recent data={data} currency={user.currency} />
        <Shelf data={data} />
        <Learning data={data} />
      </div>
    </div>
  );
}

/** The month as a printed ledger line: income, expenses, then the balance on a double rule. */
function Statement({ data, currency }: { data: Overview; currency: string }) {
  const positive = data.balance_minor >= 0;
  return (
    <section className="panel ledger-margin py-5 pl-10 pr-5 sm:pl-12 sm:pr-6">
      <h2 className="font-display text-lg font-semibold">This month</h2>
      <dl className="mt-4 space-y-3">
        <Line label="Income" icon={<ArrowDownIcon size={15} />} value={formatMoney(data.income_minor, currency)} />
        <Line label="Expenses" icon={<ArrowUpIcon size={15} />} value={formatMoney(-data.expense_minor || 0, currency)} />
      </dl>
      <div className="mt-4 border-t border-line-strong pt-4">
        <p className="text-sm font-semibold text-ink-2">{positive ? "Left this month" : "Overspent this month"}</p>
        <p
          className="num mt-1 inline-block border-b-4 border-double border-ink text-4xl font-semibold leading-tight sm:text-5xl"
          aria-label={formatMoney(data.balance_minor, currency)}
        >
          {formatMoney(data.balance_minor, currency)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone={data.savings_rate !== null && data.savings_rate >= 0.2 ? "good" : "neutral"}>
            {data.savings_rate === null ? "No income yet" : `${percent(data.savings_rate)} of income kept`}
          </Chip>
          {data.unpaid_bills_minor > 0 && <Chip tone="warn">{formatMoney(data.unpaid_bills_minor, currency)} in bills to pay</Chip>}
          {data.expected_income_minor > 0 && <Chip>{formatMoney(data.expected_income_minor, currency)} still expected</Chip>}
        </div>
      </div>
    </section>
  );
}

function Line({ label, icon, value }: { label: string; icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex items-center gap-1.5 text-ink-2">
        {icon}
        {label}
      </dt>
      <span className="leader" />
      <dd className="num text-xl font-semibold">{value}</dd>
    </div>
  );
}

function MonthlyChecklist({ data, currency }: { data: Overview; currency: string }) {
  const setPayment = useSetPayment();
  const items = data.monthly_items;
  const open = items.filter((i) => i.status !== "paid").length;
  return (
    <Panel
      title="This month's payments"
      aside={<Link href="/bills" className="text-sm font-semibold underline underline-offset-4">Open monthly</Link>}
    >
      {items.length === 0 ? (
        <EmptyState
          title="No monthly items yet"
          body="Add tuition, wifi or a tutor fee once and track every month from here."
          action={<Link href="/bills" className="btn btn-sm btn-primary">Set up monthly items</Link>}
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2">{open === 0 ? "Everything is settled for this month." : `${open} still open.`}</p>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-sm text-ink-3">Due {formatDay(item.due_date, data.today)}</p>
                </div>
                <span className="num font-semibold">{formatMoney(item.amount_minor, currency)}</span>
                <StatusChip status={item.status} kind={item.kind} />
                {item.status !== "paid" && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={setPayment.isPending}
                    onClick={() => setPayment.mutate({ id: item.id, month: data.month, paid: true })}
                    aria-label={`Mark ${item.name} as ${item.kind === "income" ? "received" : "paid"}`}
                  >
                    <CheckIcon size={14} />
                    {item.kind === "income" ? "Received" : "Paid"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {setPayment.isError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{setPayment.error.message}</p>}
        </>
      )}
    </Panel>
  );
}

function Dates({ data }: { data: Overview }) {
  return (
    <Panel title="Coming up" aside={<Link href="/dates" className="text-sm font-semibold underline underline-offset-4">All dates</Link>}>
      {data.upcoming_dates.length === 0 ? (
        <EmptyState title="Nothing to remember yet" body="Birthdays, exams and deadlines show up here as they get close." />
      ) : (
        <ul className="space-y-3">
          {data.upcoming_dates.map((d) => (
            <li key={d.id} className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-center leading-none ring-1 ring-line">
                <span className="num text-lg font-semibold">{d.next_date.slice(8)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.title}</p>
                <p className="text-sm text-ink-3">
                  {formatDay(d.next_date)}
                  {d.years ? ` · ${d.years} ${d.years === 1 ? "year" : "years"}` : ""}
                </p>
              </div>
              <Chip tone={d.days_until <= 7 ? "warn" : "neutral"}>{daysLabel(d.days_until)}</Chip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Loans({ data, currency }: { data: Overview; currency: string }) {
  const { loans } = data;
  const nothing = loans.open_count === 0;
  return (
    <Panel title="Lend and borrow" aside={<Link href="/loans" className="text-sm font-semibold underline underline-offset-4">Details</Link>}>
      {nothing ? (
        <EmptyState title="All square" body="No open loans. Record one when you lend or borrow." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-ink-2">Owed to you</p>
              <p className="num text-2xl font-semibold">{formatMoney(loans.lent_outstanding_minor, currency)}</p>
            </div>
            <div>
              <p className="text-sm text-ink-2">You owe</p>
              <p className="num text-2xl font-semibold">{formatMoney(loans.borrowed_outstanding_minor, currency)}</p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {loans.people.map((p) => (
              <li key={p.person} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate font-semibold">{p.person}</span>
                <span className="text-ink-2">{p.net_minor >= 0 ? "owes you" : "you owe"}</span>
                <span className="num font-semibold">{formatMoney(Math.abs(p.net_minor), currency)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Recent({ data, currency }: { data: Overview; currency: string }) {
  return (
    <Panel title="Latest entries" aside={<Link href="/money" className="text-sm font-semibold underline underline-offset-4">See all</Link>}>
      {data.recent_transactions.length === 0 ? (
        <EmptyState title="No entries yet" body="Your latest income and spending will line up here." />
      ) : (
        <ul className="divide-y divide-line">
          {data.recent_transactions.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <Swatch color={t.category?.color ?? "var(--ink-3)"} size={10} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.title}</p>
                <p className="text-sm text-ink-3">
                  {t.category?.name ?? "Uncategorized"} · {formatDay(t.date, data.today)}
                </p>
              </div>
              <span className="num font-semibold">{formatMoney(t.kind === "income" ? t.amount_minor : -t.amount_minor, currency, { sign: true })}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Shelf({ data }: { data: Overview }) {
  const { books } = data;
  return (
    <Panel title="Reading" aside={<Link href="/books" className="text-sm font-semibold underline underline-offset-4">Library</Link>}>
      {books.reading.length === 0 && books.to_buy_count === 0 && books.read_count === 0 ? (
        <EmptyState title="An empty shelf" body="Add the books you want to buy or have already read." />
      ) : (
        <>
          {books.reading.length > 0 ? (
            <ul className="space-y-2">
              {books.reading.map((b) => (
                <li key={b.id}>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-sm text-ink-3">{b.author}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">Not reading anything right now.</p>
          )}
          <p className="mt-4 text-sm text-ink-2">
            {books.read_count} finished · {books.to_buy_count} on the wish list
          </p>
        </>
      )}
    </Panel>
  );
}

function Learning({ data }: { data: Overview }) {
  const { tools } = data;
  return (
    <Panel title="Learn next" aside={<Link href="/learn" className="text-sm font-semibold underline underline-offset-4">Backlog</Link>}>
      {tools.next.length === 0 ? (
        <EmptyState title="Backlog is clear" body="Add the tools you want to pick up next." />
      ) : (
        <>
          <ul className="space-y-2">
            {tools.next.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t.name}</span>
                <Chip tone={t.priority === "high" ? "warn" : "neutral"}>{t.priority}</Chip>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-2">
            {tools.learning_count} in progress · {tools.done_count} learned
          </p>
        </>
      )}
    </Panel>
  );
}
