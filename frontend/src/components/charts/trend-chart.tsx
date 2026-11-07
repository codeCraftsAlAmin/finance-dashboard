"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney, monthLabel, monthShort } from "@/lib/format";
import type { MonthTotal } from "@/lib/types";
import { AXIS, ChartFrame, GRID, LegendRow, TooltipCard, type SeriesSpec } from "./chart-kit";

const SERIES: SeriesSpec[] = [
  { key: "income_minor", name: "Income", color: "var(--series-1)" },
  { key: "expense_minor", name: "Expenses", color: "var(--series-2)" },
];

/** Income against expenses over the last few months: two lines on one money axis. */
export function TrendChart({ data, currency, height = 240 }: { data: MonthTotal[]; currency: string; height?: number }) {
  const summary = `Income and expenses for ${data.length} months, ${monthLabel(data[0].month)} to ${monthLabel(data[data.length - 1].month)}.`;
  return (
    <ChartFrame
      summary={summary}
      legend={<LegendRow series={SERIES} shape="line" />}
      table={{
        head: ["Month", "Income", "Expenses"],
        rows: data.map((d) => [monthLabel(d.month), formatMoney(d.income_minor, currency), formatMoney(d.expense_minor, currency)]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tickFormatter={monthShort} {...AXIS} />
          <YAxis width={52} tickFormatter={(v: number) => formatCompact(v, currency)} {...AXIS} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={monthLabel(String(label), true)}
                  rows={SERIES.map((s) => ({
                    name: s.name,
                    color: s.color,
                    value: formatMoney(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0), currency),
                  }))}
                />
              ) : null
            }
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, fill: s.color, stroke: "var(--surface)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
