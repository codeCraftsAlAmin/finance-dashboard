"use client";

import { useState, type FormEvent } from "react";
import { formatDay, formatMoney, minorToInput, monthShort, parseMoney } from "@/lib/format";
import {
  useBooks,
  useBookSummary,
  useCreateBook,
  useDeleteBook,
  usePurchaseBook,
  useToday,
  useUpdateBook,
  useUser,
} from "@/lib/hooks";
import type { Book, BookStatus } from "@/lib/types";
import { ColumnChart } from "../charts/bars";
import { Donut } from "../charts/donut";
import { CheckIcon, PencilIcon, PlusIcon, StarIcon, TrashIcon } from "../icons";
import { MoneyInput } from "../money-input";
import {
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

type Tab = "to_buy" | "shelf" | "read";

const STATUS_LABEL: Record<BookStatus, string> = {
  to_buy: "Want to buy",
  to_read: "Bought, not started",
  reading: "Reading now",
  read: "Finished",
};

export function BooksPage() {
  const user = useUser();
  const today = useToday();
  const books = useBooks();
  const summary = useBookSummary();
  const [tab, setTab] = useState<Tab>("to_buy");
  const [editing, setEditing] = useState<{ book: Book | null } | null>(null);
  const [buying, setBuying] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const remove = useDeleteBook();
  const update = useUpdateBook();
  const currency = user.currency;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  const all = books.data ?? [];
  const inTab = (b: Book) => (tab === "to_buy" ? b.status === "to_buy" : tab === "read" ? b.status === "read" : b.status === "to_read" || b.status === "reading");
  const shown = all.filter(inTab);
  const s = summary.data;

  return (
    <div className="fade-in">
      <PageHeader
        title="Books"
        lead="What you want to buy, what is on your shelf, and what you have finished."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ book: null })}>
            <PlusIcon size={16} />
            Add a book
          </button>
        }
      />

      {books.isPending || summary.isPending ? (
        <Loading />
      ) : books.isError ? (
        <LoadError error={books.error} retry={() => books.refetch()} />
      ) : summary.isError ? (
        <LoadError error={summary.error} retry={() => summary.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Wish list cost" value={formatMoney(s!.to_buy_total_minor, currency)} note={`${s!.to_buy_count} books to buy`} />
            <Stat label="Read this year" value={String(s!.read_this_year)} note={`${s!.read_count} finished in total`} />
            <Stat label="Spent on books" value={formatMoney(s!.spent_on_books_minor, currency)} note="Books you have bought" />
          </div>

          {all.length > 0 && (
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Panel title="Books finished, last 6 months">
                <ColumnChart
                  data={s!.read_by_month.map((m) => ({ label: monthShort(m.month), title: m.month, books: m.count }))}
                  series={[{ key: "books", name: "Books finished", color: "var(--series-1)" }]}
                  formatValue={(v) => `${v} ${v === 1 ? "book" : "books"}`}
                  formatTick={(v) => String(v)}
                  height={180}
                  summary="Number of books finished in each of the last six months."
                  tableHead="Month"
                />
              </Panel>
              <Panel title="Your library">
                <Donut
                  centerLabel="books"
                  currency={currency}
                  height={160}
                  formatValue={(v) => String(v)}
                  slices={[
                    { name: "Finished", color: "var(--series-1)", value: s!.read_count },
                    { name: "Reading now", color: "var(--series-3)", value: s!.reading_count },
                    { name: "Bought, not started", color: "var(--series-4)", value: s!.to_read_count },
                    { name: "Want to buy", color: "var(--series-5)", value: s!.to_buy_count },
                  ].filter((x) => x.value > 0)}
                />
              </Panel>
            </div>
          )}

          <div className="mb-3 mt-6">
            <Segmented
              label="Books"
              value={tab}
              onChange={setTab}
              options={[
                { value: "to_buy", label: "To buy", count: all.filter((b) => b.status === "to_buy").length },
                { value: "shelf", label: "My shelf", count: all.filter((b) => b.status === "to_read" || b.status === "reading").length },
                { value: "read", label: "Read", count: all.filter((b) => b.status === "read").length },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <Panel>
              <EmptyState
                title={tab === "to_buy" ? "Your wish list is empty" : tab === "read" ? "No finished books yet" : "Nothing on your shelf"}
                body={
                  tab === "to_buy"
                    ? "Add books you want to buy with their author and price."
                    : tab === "read"
                      ? "Mark a book as finished and it will show up here with your rating."
                      : "Books you have bought but not finished will appear here."
                }
                action={
                  <button type="button" className="btn btn-primary" onClick={() => setEditing({ book: null })}>
                    Add a book
                  </button>
                }
              />
            </Panel>
          ) : (
            <Panel pad={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-left sm:min-w-[36rem]">
                  <thead>
                    <tr className="border-b border-line text-sm text-ink-2">
                      <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">Book</th>
                      <th scope="col" className="hidden px-2 py-2.5 font-semibold sm:table-cell">Author</th>
                      <th scope="col" className="px-2 py-2.5 text-right font-semibold">Price</th>
                      <th scope="col" className="px-2 py-2.5 font-semibold">{tab === "read" ? "Finished" : "Status"}</th>
                      <th scope="col" className="px-4 py-2.5 sm:px-5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((book) => (
                      <tr key={book.id}>
                        <td className="px-4 py-3 font-semibold sm:px-5">
                          {book.title}
                          <span className="block text-sm font-normal text-ink-2 sm:hidden">{book.author}</span>
                          {book.notes && <span className="block text-sm font-normal text-ink-3">{book.notes}</span>}
                        </td>
                        <td className="hidden px-2 py-3 text-ink-2 sm:table-cell">{book.author}</td>
                        <td className="num px-2 py-3 text-right">{book.price_minor ? formatMoney(book.price_minor, currency) : "–"}</td>
                        <td className="px-2 py-3 text-sm text-ink-2">
                          {book.status === "read" ? (
                            <span className="flex flex-col">
                              <Stars value={book.rating} />
                              {book.finished_on && <span>{formatDay(book.finished_on, today)}</span>}
                            </span>
                          ) : (
                            STATUS_LABEL[book.status]
                          )}
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <div className="flex flex-wrap justify-end gap-1">
                            {book.status === "to_buy" && (
                              <button type="button" className="btn btn-sm btn-primary whitespace-nowrap" onClick={() => setBuying(book)}>
                                Bought it
                              </button>
                            )}
                            {book.status === "to_read" && (
                              <button type="button" className="btn btn-sm" disabled={update.isPending} onClick={() => update.mutate({ id: book.id, status: "reading" })}>
                                Start reading
                              </button>
                            )}
                            {book.status === "reading" && (
                              <button type="button" className="btn btn-sm" onClick={() => setEditing({ book: { ...book, status: "read" } })}>
                                <CheckIcon size={14} />
                                Finished
                              </button>
                            )}
                            <button type="button" className="btn btn-sm" aria-label={`Edit ${book.title}`} onClick={() => setEditing({ book })}>
                              <PencilIcon size={15} />
                            </button>
                            <button type="button" className="btn btn-sm" aria-label={`Delete ${book.title}`} onClick={() => setDeleting(book)}>
                              <TrashIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {tab === "to_buy" && (
                    <tfoot>
                      <tr className="border-t border-line-strong">
                        <th scope="row" className="px-4 py-3 text-left font-semibold sm:px-5">Total to buy</th>
                        <td className="hidden sm:table-cell" />
                        <td className="num px-2 py-3 text-right font-semibold">{formatMoney(shown.reduce((sum, b) => sum + (b.price_minor ?? 0), 0), currency)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Panel>
          )}
          {update.isError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{update.error.message}</p>}
        </>
      )}

      <BookDialog
        key={editing ? `book-${editing.book?.id ?? "new"}-${editing.book?.status ?? ""}` : "closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        editing={editing?.book ?? null}
        defaultStatus={tab === "read" ? "read" : tab === "shelf" ? "to_read" : "to_buy"}
      />
      <PurchaseDialog key={buying ? `buy-${buying.id}` : "none"} book={buying} onClose={() => setBuying(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this book?"
        body={deleting && <><strong className="text-ink">{deleting.title}</strong> will be removed from your list.</>}
        confirmLabel="Delete book"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num mt-1 text-3xl font-semibold leading-tight">{value}</p>
      <p className="mt-1 text-sm text-ink-3">{note}</p>
    </div>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-ink-3">Not rated</span>;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={14} className={n <= value ? "text-warn" : "text-line-strong"} style={n <= value ? { fill: "currentColor" } : undefined} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------------------ dialogs */

function BookDialog({
  open,
  onClose,
  editing,
  defaultStatus,
}: {
  open: boolean;
  onClose: () => void;
  editing: Book | null;
  defaultStatus: BookStatus;
}) {
  return (
    <Modal open={open} onClose={onClose} title={editing && editing.id ? "Edit book" : "Add a book"}>
      <BookForm onClose={onClose} editing={editing} defaultStatus={defaultStatus} />
    </Modal>
  );
}

function BookForm({ onClose, editing, defaultStatus }: { onClose: () => void; editing: Book | null; defaultStatus: BookStatus }) {
  const user = useUser();
  const create = useCreateBook();
  const update = useUpdateBook();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [author, setAuthor] = useState(editing?.author ?? "");
  const [price, setPrice] = useState(editing?.price_minor ? minorToInput(editing.price_minor) : "");
  const [status, setStatus] = useState<BookStatus>(editing?.status ?? defaultStatus);
  const [rating, setRating] = useState(editing?.rating ? String(editing.rating) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [localError, setLocalError] = useState<Error | null>(null);
  const mutation = editing ? update : create;

  async function submit(event: FormEvent) {
    event.preventDefault();
    let priceMinor: number | null = null;
    if (price.trim()) {
      priceMinor = parseMoney(price);
      if (priceMinor === null) return setLocalError(new Error("Enter the price as a number, like 450 or 450.50."));
    }
    setLocalError(null);
    const input = {
      title: title.trim(),
      author: author.trim(),
      price_minor: priceMinor,
      status,
      rating: status === "read" && rating ? Number(rating) : null,
      notes: notes.trim() || null,
    };
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
      <Field label="Book name" htmlFor="bk-title">
        <input id="bk-title" className="field" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Author" htmlFor="bk-author">
        <input id="bk-author" className="field" required maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price (optional)" htmlFor="bk-price">
          <MoneyInput id="bk-price" required={false} value={price} onChange={setPrice} currency={user.currency} />
        </Field>
        <Field label="Status" htmlFor="bk-status">
          <select id="bk-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as BookStatus)}>
            {(Object.keys(STATUS_LABEL) as BookStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {status === "read" && (
        <Field label="Your rating" htmlFor="bk-rating">
          <select id="bk-rating" className="field" value={rating} onChange={(e) => setRating(e.target.value)}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Notes (optional)" htmlFor="bk-notes">
        <input id="bk-notes" className="field" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <ErrorNote error={localError ?? mutation.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing?.id ? "Save changes" : "Add book"}
        </button>
      </DialogActions>
    </form>
  );
}

function PurchaseDialog({ book, onClose }: { book: Book | null; onClose: () => void }) {
  return (
    <Modal open={book !== null} onClose={onClose} title="Bought it?">
      {book && <PurchaseForm book={book} onClose={onClose} />}
    </Modal>
  );
}

function PurchaseForm({ book, onClose }: { book: Book; onClose: () => void }) {
  const user = useUser();
  const today = useToday();
  const purchase = usePurchaseBook();
  const [date, setDate] = useState(today);
  const [record, setRecord] = useState(true);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await purchase.mutateAsync({ id: book.id, date, record_expense: record && !!book.price_minor });
      onClose();
    } catch {
      // Shown below.
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="text-ink-2">
        <strong className="text-ink">{book.title}</strong> moves to your shelf.
      </p>
      <Field label="Date bought" htmlFor="pb-date">
        <input id="pb-date" type="date" className="field" required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </Field>
      {book.price_minor ? (
        <label className="flex items-start gap-2.5">
          <input type="checkbox" className="mt-1 size-4" checked={record} onChange={(e) => setRecord(e.target.checked)} />
          <span>
            Add {formatMoney(book.price_minor, user.currency)} to my expenses
            <span className="block text-sm text-ink-3">Recorded under Books in Money.</span>
          </span>
        </label>
      ) : (
        <p className="text-sm text-ink-3">No price saved, so no expense will be added.</p>
      )}
      <ErrorNote error={purchase.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={purchase.isPending}>
          {purchase.isPending ? "Saving…" : "Move to shelf"}
        </button>
      </DialogActions>
    </form>
  );
}
