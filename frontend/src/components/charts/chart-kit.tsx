"use client";

import { useId, useState, type ReactNode } from "react";
import { Segmented } from "../ui";

/** Shared look for every chart: recessive grid and axes, text in text tokens. */
export const AXIS = {
  tick: { fill: "var(--ink-3)", fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: "var(--line-strong)" },
} as const;

export const GRID = { stroke: "var(--grid)", vertical: false } as const;

export interface SeriesSpec {
  key: string;
  name: string;
  color: string;
}

export function LegendRow({ series, shape = "rect" }: { series: SeriesSpec[]; shape?: "rect" | "line" }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2" aria-label="Legend">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block"
            style={
              shape === "line"
                ? { width: 14, height: 2, background: item.color, borderRadius: 2 }
                : { width: 10, height: 10, background: item.color, borderRadius: 3 }
            }
          />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

interface TipRow {
  name: string;
  value: string;
  color: string;
}

/** The hover readout: values lead (strong), series names follow (secondary), line keys not boxes. */
export function TooltipCard({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="pointer-events-none min-w-36 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: row.color }} />
            <span className="num font-semibold text-ink">{row.value}</span>
            <span className="text-ink-2">{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TableView {
  head: string[];
  rows: (string | number)[][];
}

/** Every chart can be read as a table: a keyboard- and screen-reader-friendly twin. */
export function ChartFrame({
  summary,
  legend,
  table,
  children,
}: {
  summary: string;
  legend?: ReactNode;
  table: TableView;
  children: ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>{legend}</div>
        <Segmented
          size="sm"
          label="Chart or table"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      {view === "chart" ? (
        <div role="img" aria-label={summary} id={id}>
          {children}
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{summary}</caption>
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                {table.head.map((cell, index) => (
                  <th key={cell} scope="col" className={`px-3 py-2 font-semibold ${index > 0 ? "text-right" : ""}`}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={String(row[0])} className="border-t border-line">
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row" className="px-3 py-1.5 font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={index} className="num px-3 py-1.5 text-right">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
