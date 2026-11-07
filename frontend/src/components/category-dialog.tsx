"use client";

import { useState, type FormEvent } from "react";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/lib/hooks";
import type { Kind } from "@/lib/types";
import { TrashIcon } from "./icons";
import { DialogActions, ErrorNote, Field, Modal, Segmented, Swatch } from "./ui";

// The validated categorical palette, in order.
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];

export function CategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Categories" description="Group entries so the charts can show where money goes.">
      <Body onClose={onClose} />
    </Modal>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [kind, setKind] = useState<Kind>("expense");
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      await create.mutateAsync({ kind, name: name.trim(), color });
      setName("");
    } catch {
      // Shown below.
    }
  }

  const list = (categories.data ?? []).filter((c) => c.kind === kind);

  return (
    <div className="mt-5 space-y-5">
      <Segmented
        label="Category type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />
      <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-lg border border-line">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2">
            <Swatch color={c.color} size={12} />
            <span className="flex-1 truncate font-medium">{c.name}</span>
            <button
              type="button"
              className="btn btn-sm btn-ghost btn-icon"
              aria-label={`Delete ${c.name}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate(c.id)}
            >
              <TrashIcon size={16} />
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-4 text-center text-ink-2">No categories yet.</li>}
      </ul>
      <p className="-mt-3 text-sm text-ink-3">Deleting a category keeps its entries; they just become uncategorized.</p>

      <form onSubmit={add} className="space-y-3 border-t border-line pt-4">
        <Field label="New category" htmlFor="cat-name">
          <input id="cat-name" className="field" value={name} maxLength={40} required placeholder="Groceries" onChange={(e) => setName(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Color</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="size-8 rounded-full ring-offset-2 ring-offset-surface transition-shadow aria-pressed:ring-2 aria-pressed:ring-ink"
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <ErrorNote error={create.error ?? remove.error} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={create.isPending}>
          Add category
        </button>
      </form>
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </DialogActions>
    </div>
  );
}
