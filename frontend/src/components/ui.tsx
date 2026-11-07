"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertIcon } from "./icons";

/* ------------------------------------------------------------------------------- modal */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}

/** A modal built on the native <dialog>: focus trapping, Esc to close and inertness come free. */
export function Modal({ open, onClose, title, description, children, wide }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl"
      style={{ width: `min(${wide ? "38rem" : "30rem"}, calc(100vw - 1.5rem))` }}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <h2 id={titleId} className="font-display text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ErrorNote({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
      <AlertIcon size={16} className="mt-0.5 shrink-0" />
      {error.message}
    </p>
  );
}

/** Buttons at the bottom of a dialog: secondary on the left, primary on the right. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  pending: boolean;
  error?: Error | null;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onClose, title, body, confirmLabel, pending, error, onConfirm }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mt-3 space-y-4">
        <div className="text-ink-2">{body}</div>
        <ErrorNote error={error} />
      </div>
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Keep it
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Deleting…" : confirmLabel}
        </button>
      </DialogActions>
    </Modal>
  );
}

/* ------------------------------------------------------------------------------ fields */

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
  size?: "sm" | "md";
}

/** A radio group drawn as joined buttons: for 2–5 mutually exclusive choices. */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-[10px] border border-line-strong bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`whitespace-nowrap rounded-[8px] px-3 font-semibold transition-colors ${
              size === "sm" ? "min-h-8 text-sm" : "min-h-10 text-sm"
            } ${selected ? "bg-surface text-ink shadow-sm ring-1 ring-line-strong" : "text-ink-2 hover:text-ink"}`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1.5 text-ink-3 tabular-nums">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- page pieces */

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {lead && <p className="mt-1 max-w-xl text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-ink-2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
  pad = true,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          {title && <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>}
          {aside}
        </div>
      )}
      <div className={pad ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-40 place-items-center text-ink-3">
      <span className="flex items-center gap-2">
        <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
        {label}…
      </span>
    </div>
  );
}

export function LoadError({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-5">
      <ErrorNote error={error} />
      {retry && (
        <button type="button" className="btn btn-sm" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-danger-soft text-danger",
};

export function Chip({ tone = "neutral", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`chip ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function Swatch({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-[3px]"
      style={{ width: size, height: size, background: color }}
    />
  );
}
