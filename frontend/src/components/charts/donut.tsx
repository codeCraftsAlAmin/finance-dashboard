"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney, percent } from "@/lib/format";
import { Swatch } from "../ui";
import { TooltipCard } from "./chart-kit";

export interface Slice {
  name: string;
  color: string;
  value: number;
}

/**
 * A donut with its legend as a ranked list. The list carries every name, amount and share,
 * so nothing depends on hover or on telling colors apart.
 */
export function Donut({
  slices,
  currency,
  centerLabel,
  height = 200,
  formatValue,
}: {
  slices: Slice[];
  currency: string;
  centerLabel: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const fmt = formatValue ?? ((value: number) => formatMoney(value, currency));
  const summary = `${centerLabel}: ${slices.map((s) => `${s.name} ${fmt(s.value)}`).join(", ")}.`;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <div role="img" aria-label={summary} className="relative mx-auto w-full max-w-[13rem]">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onMouseLeave={() => setHovered(null)}
              onMouseEnter={(_, index) => setHovered(index)}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.name} fill={slice.color} opacity={hovered === null || hovered === index ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const item = payload?.[0];
                if (!active || !item) return null;
                const slice = item.payload as Slice;
                return (
                  <TooltipCard
                    title={slice.name}
                    rows={[{ name: percent(total ? slice.value / total : 0), color: slice.color, value: fmt(slice.value) }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="num text-xl font-semibold leading-tight">{fmt(total)}</p>
            <p className="text-xs text-ink-3">{centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="space-y-1.5">
        {slices.map((slice, index) => (
          <li
            key={slice.name}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2 text-sm"
          >
            <Swatch color={slice.color} />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="num font-semibold">{fmt(slice.value)}</span>
            <span className="w-10 text-right text-ink-3">{percent(total ? slice.value / total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
