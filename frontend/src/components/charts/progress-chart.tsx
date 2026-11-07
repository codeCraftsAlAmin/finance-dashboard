"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/format";
import type { ProgressPoint } from "@/lib/challenge";
import { AXIS, ChartFrame, GRID, LegendRow, TooltipCard, type SeriesSpec } from "./chart-kit";

const SERIES: SeriesSpec[] = [
  { key: "done", name: "Days you completed", color: "var(--series-1)" },
  { key: "pace", name: "One day every day", color: "var(--ink-3)" },
];

/** Days completed so far against the pace of one per day, over the length of the challenge. */
export function ProgressChart({ data, total, height = 220 }: { data: ProgressPoint[]; total: number; height?: number }) {
  const latest = [...data].reverse().find((p) => p.done !== null);
  const summary = `Progress over ${total} days. ${latest ? `${latest.done} days completed by day ${latest.day}.` : "No days completed yet."}`;
  return (
    <ChartFrame
      summary={summary}
      legend={<LegendRow series={SERIES} shape="line" />}
      table={{
        head: ["Day", "Completed", "Pace"],
        rows: data.map((p) => [`Day ${p.day} · ${formatDay(p.date)}`, p.done ?? "–", p.pace]),
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" type="number" domain={[1, total]} ticks={ticksFor(total)} {...AXIS} />
          <YAxis width={32} domain={[0, total]} allowDecimals={false} ticks={ticksFor(total, true)} {...AXIS} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ProgressPoint | undefined;
              return active && point ? (
                <TooltipCard
                  title={`Day ${point.day} · ${formatDay(point.date)}`}
                  rows={[
                    { name: SERIES[0].name, color: SERIES[0].color, value: point.done === null ? "–" : String(point.done) },
                    { name: SERIES[1].name, color: SERIES[1].color, value: String(point.pace) },
                  ]}
                />
              ) : null;
            }}
          />
          <Line type="linear" dataKey="pace" name={SERIES[1].name} stroke={SERIES[1].color} strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
          <Line
            type="stepAfter"
            dataKey="done"
            name={SERIES[0].name}
            stroke={SERIES[0].color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ticksFor(total: number, yAxis = false) {
  const step = total <= 14 ? (yAxis ? 2 : 1) : total <= 35 ? (yAxis ? 5 : 5) : 10;
  const ticks = [];
  for (let v = yAxis ? 0 : step; v < total; v += step) ticks.push(v);
  if (!yAxis) ticks.unshift(1);
  ticks.push(total);
  return ticks;
}
