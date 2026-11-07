"use client";

import { useState, type FormEvent } from "react";
import { useCreateTool, useDeleteTool, useTools, useToolSummary, useUpdateTool } from "@/lib/hooks";
import type { LearnTool, Priority, ToolStatus } from "@/lib/types";
import { Donut } from "../charts/donut";
import { ExternalIcon, PencilIcon, PlusIcon, TrashIcon } from "../icons";
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

const COLUMNS: { status: ToolStatus; title: string; empty: string }[] = [
  { status: "next", title: "Up next", empty: "Add the tools you plan to learn." },
  { status: "learning", title: "Learning now", empty: "Move a tool here when you start." },
  { status: "done", title: "Learned", empty: "Finished tools collect here." },
];
const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
const PRIORITY_TONE = { high: "bad", medium: "warn", low: "neutral" } as const;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LearnPage() {
  const tools = useTools();
  const summary = useToolSummary();
  const update = useUpdateTool();
  const remove = useDeleteTool();
  const [editing, setEditing] = useState<{ tool: LearnTool | null } | null>(null);
  const [deleting, setDeleting] = useState<LearnTool | null>(null);
  const [view, setView] = useState<ToolStatus>("next");

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const all = tools.data ?? [];
  const s = summary.data;

  return (
    <div className="fade-in">
      <PageHeader
        title="Tools to learn"
        lead="The next things you plan to learn, with notes and a link to where to start."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ tool: null })}>
            <PlusIcon size={16} />
            Add a tool
          </button>
        }
      />

      {tools.isPending || summary.isPending ? (
        <Loading />
      ) : tools.isError ? (
        <LoadError error={tools.error} retry={() => tools.refetch()} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState
            title="Your learning list is empty"
            body="Add a tool, a note on why it matters, and a link to the docs or a course."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setEditing({ tool: null })}>
                Add the first tool
              </button>
            }
          />
        </Panel>
      ) : (
        <>
          {s && (
            <Panel title="Progress" className="mb-4">
              <Donut
                centerLabel="tools"
                currency="BDT"
                height={150}
                formatValue={(v) => String(v)}
                slices={[
                  { name: "Learned", color: "var(--series-3)", value: s.done_count },
                  { name: "Learning now", color: "var(--series-1)", value: s.learning_count },
                  { name: "Up next", color: "var(--series-4)", value: s.next_count },
                ].filter((x) => x.value > 0)}
              />
            </Panel>
          )}

          <div className="mb-3 lg:hidden">
            <Segmented
              label="Column"
              value={view}
              onChange={setView}
              options={COLUMNS.map((c) => ({ value: c.status, label: c.title, count: all.filter((t) => t.status === c.status).length }))}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((column) => {
              const items = all.filter((t) => t.status === column.status);
              return (
                <section
                  key={column.status}
                  aria-label={column.title}
                  className={`${view === column.status ? "block" : "hidden"} lg:block`}
                >
                  <h2 className="mb-2 hidden items-baseline gap-2 font-display text-lg font-semibold lg:flex">
                    {column.title}
                    <span className="num text-sm font-normal text-ink-3">{items.length}</span>
                  </h2>
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-3">{column.empty}</div>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((tool) => (
                        <li key={tool.id} className="panel p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-lg font-semibold leading-snug">{tool.name}</h3>
                            <Chip tone={PRIORITY_TONE[tool.priority]}>{PRIORITY_LABEL[tool.priority]}</Chip>
                          </div>
                          {tool.details && <p className="mt-1 text-sm text-ink-2">{tool.details}</p>}
                          {tool.source_url && (
                            <a
                              href={tool.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
                            >
                              {host(tool.source_url)}
                              <ExternalIcon size={14} />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            {tool.status === "next" && (
                              <button type="button" className="btn btn-sm btn-primary" disabled={update.isPending} onClick={() => update.mutate({ id: tool.id, status: "learning" })}>
                                Start learning
                              </button>
                            )}
                            {tool.status === "learning" && (
                              <>
                                <button type="button" className="btn btn-sm btn-primary" disabled={update.isPending} onClick={() => update.mutate({ id: tool.id, status: "done" })}>
                                  Mark learned
                                </button>
                                <button type="button" className="btn btn-sm" disabled={update.isPending} onClick={() => update.mutate({ id: tool.id, status: "next" })}>
                                  Back to next
                                </button>
                              </>
                            )}
                            {tool.status === "done" && (
                              <button type="button" className="btn btn-sm" disabled={update.isPending} onClick={() => update.mutate({ id: tool.id, status: "learning" })}>
                                Revisit
                              </button>
                            )}
                            <span className="ml-auto flex gap-1">
                              <button type="button" className="btn btn-sm" aria-label={`Edit ${tool.name}`} onClick={() => setEditing({ tool })}>
                                <PencilIcon size={15} />
                              </button>
                              <button type="button" className="btn btn-sm" aria-label={`Delete ${tool.name}`} onClick={() => setDeleting(tool)}>
                                <TrashIcon size={15} />
                              </button>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          {update.isError && <p role="alert" className="mt-3 text-sm font-medium text-danger">{update.error.message}</p>}
        </>
      )}

      <ToolDialog
        key={editing ? `tool-${editing.tool?.id ?? "new"}` : "closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing?.tool ?? null}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this tool?"
        body={deleting && <><strong className="text-ink">{deleting.name}</strong> will be removed from your list.</>}
        confirmLabel="Delete tool"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ToolDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: LearnTool | null }) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit tool" : "Add a tool"}>
      <ToolForm onClose={onClose} editing={editing} />
    </Modal>
  );
}

function ToolForm({ onClose, editing }: { onClose: () => void; editing: LearnTool | null }) {
  const create = useCreateTool();
  const update = useUpdateTool();
  const [name, setName] = useState(editing?.name ?? "");
  const [details, setDetails] = useState(editing?.details ?? "");
  const [url, setUrl] = useState(editing?.source_url ?? "");
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? "medium");
  const [status, setStatus] = useState<ToolStatus>(editing?.status ?? "next");
  const mutation = editing ? update : create;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { name: name.trim(), details: details.trim() || null, source_url: url.trim() || null, priority, status };
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
      <Field label="Tool" htmlFor="tl-name">
        <input id="tl-name" className="field" required maxLength={80} placeholder="PostgreSQL" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Details (optional)" htmlFor="tl-details" hint="Why it matters, or what you want to learn.">
        <textarea id="tl-details" className="field" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      </Field>
      <Field label="Source link (optional)" htmlFor="tl-url">
        <input id="tl-url" type="url" inputMode="url" className="field" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="tl-priority">
          <select id="tl-priority" className="field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Status" htmlFor="tl-status">
          <select id="tl-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as ToolStatus)}>
            <option value="next">Up next</option>
            <option value="learning">Learning now</option>
            <option value="done">Learned</option>
          </select>
        </Field>
      </div>
      <ErrorNote error={mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add tool"}
        </button>
      </DialogActions>
    </form>
  );
}
