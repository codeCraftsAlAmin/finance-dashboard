"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartFrame, GRID, LegendRow, TooltipCard, type SeriesSpec } from "./chart-kit";

export interface ColumnDatum {
  label: string;
  title?: string;
  [series: string]: string | number | undefined;
}

/** Vertical bars, one or more series, stacked or side by side. Rounded tops, a 2px gap between fills. */
export function ColumnChart({
  data,
  series,
  stacked = false,
  formatValue,
  formatTick,
  tickInterval,
  height = 220,
  summary,
  tableHead,
}: {
  data: ColumnDatum[];
  series: SeriesSpec[];
  stacked?: boolean;
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  tickInterval?: number | "preserveStartEnd";
  height?: number;
  summary: string;
  tableHead: string;
}) {
  return (
    <ChartFrame
      summary={summary}
      legend={series.length > 1 ? <LegendRow series={series} /> : undefined}
      table={{
        head: [tableHead, ...series.map((s) => s.name)],
        rows: data.map((d) => [d.title ?? d.label, ...series.map((s) => formatValue(Number(d[s.key] ?? 0)))]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" interval={tickInterval ?? 0} {...AXIS} />
          <YAxis width={48} allowDecimals={false} tickFormatter={formatTick ?? formatValue} {...AXIS} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as ColumnDatum;
              return (
                <TooltipCard
                  title={datum.title ?? datum.label}
                  rows={series.map((s) => ({ name: s.name, color: s.color, value: formatValue(Number(datum[s.key] ?? 0)) }))}
                />
              );
            }}
          />
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              stackId={stacked ? "stack" : undefined}
              // Only the top segment of a stack is rounded.
              radius={stacked ? (index === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
              stroke={stacked ? "var(--surface)" : undefined}
              strokeWidth={stacked ? 2 : 0}
              isAnimationActive={false}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export interface BalanceDatum {
  name: string;
  value: number; // positive: owed to you, negative: you owe
}

/** Horizontal bars around a zero line: right of it people owe you, left of it you owe them. */
export function BalanceBars({
  data,
  formatValue,
  formatTick,
  positiveLabel,
  negativeLabel,
}: {
  data: BalanceDatum[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  positiveLabel: string;
  negativeLabel: string;
}) {
  const height = Math.max(120, data.length * 44 + 36);
  return (
    <ChartFrame
      summary={`Net balance per person. ${data.map((d) => `${d.name}: ${formatValue(d.value)}`).join(", ")}.`}
      legend={
        <LegendRow
          series={[
            { key: "pos", name: positiveLabel, color: "var(--series-1)" },
            { key: "neg", name: negativeLabel, color: "var(--series-2)" },
          ]}
        />
      }
      table={{ head: ["Person", "Net"], rows: data.map((d) => [d.name, formatValue(d.value)]) }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={formatTick} {...AXIS} />
          <YAxis type="category" dataKey="name" width={84} {...AXIS} axisLine={false} />
          <ReferenceLine x={0} stroke="var(--ink-3)" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as BalanceDatum;
              const positive = datum.value >= 0;
              return (
                <TooltipCard
                  title={datum.name}
                  rows={[
                    {
                      name: positive ? positiveLabel : negativeLabel,
                      color: positive ? "var(--series-1)" : "var(--series-2)",
                      value: formatValue(Math.abs(datum.value)),
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={4} isAnimationActive={false} maxBarSize={24}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.value >= 0 ? "var(--series-1)" : "var(--series-2)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
