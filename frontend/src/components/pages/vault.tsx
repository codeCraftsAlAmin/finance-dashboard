"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { queryKeys, useAccounts, useVaultStatus } from "@/lib/hooks";
import type { VaultAccount } from "@/lib/types";
import { useVaultSession, VaultSessionProvider } from "@/lib/vault-session";
import { CopyIcon, ExternalIcon, EyeIcon, EyeOffIcon, KeyIcon, LockIcon, PencilIcon, PlusIcon, TrashIcon, UnlockIcon } from "../icons";
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
} from "../ui";

const CATEGORY_SUGGESTIONS = ["Email", "Social", "Developer", "Banking", "Shopping", "Education", "Other"];
const REVEAL_SECONDS = 15;

export function VaultPage() {
  // The unlock session lives inside this page, so leaving it locks the vault again.
  return (
    <VaultSessionProvider>
      <VaultInner />
    </VaultSessionProvider>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }
  return { copied, copy };
}

function generatePassword(length = 18) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
  const limit = 256 - (256 % alphabet.length); // rejection sampling: no modulo bias
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

function VaultInner() {
  const status = useVaultStatus();
  const accounts = useAccounts();
  const session = useVaultSession();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<VaultAccount | null>(null);
  const [deleting, setDeleting] = useState<VaultAccount | null>(null);
  const [resetting, setResetting] = useState(false);
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => client.invalidateQueries({ queryKey: [...queryKeys.vault, "accounts"] }),
  });

  const unlocked = session.token !== null;

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      // Shown in the dialog.
    }
  }

  if (status.isPending) return <Loading />;
  if (status.isError) return <LoadError error={status.error} retry={() => status.refetch()} />;

  if (!status.data.initialized) {
    return (
      <div className="fade-in">
        <PageHeader title="Vault" lead="Your logins, encrypted so only your master password can read them." />
        <SetupPanel />
      </div>
    );
  }

  const list = accounts.data ?? [];
  const groups = Array.from(new Set(list.map((a) => a.category))).sort();

  return (
    <div className="fade-in">
      <PageHeader
        title="Vault"
        lead="Usernames are listed here. Passwords stay encrypted until you unlock the vault with your master password."
        actions={
          <>
            {unlocked ? (
              <>
                <Chip tone="good" icon={<UnlockIcon size={13} />}>
                  Unlocked · locks in {Math.floor((session.secondsLeft ?? 0) / 60)}:{String((session.secondsLeft ?? 0) % 60).padStart(2, "0")}
                </Chip>
                <button type="button" className="btn" onClick={session.lock}>
                  <LockIcon size={16} />
                  Lock now
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                  <PlusIcon size={16} />
                  Add account
                </button>
              </>
            ) : (
              <Chip icon={<LockIcon size={13} />}>Locked</Chip>
            )}
          </>
        }
      />

      {!unlocked && <UnlockPanel onForgot={() => setResetting(true)} />}

      {accounts.isPending ? (
        <Loading />
      ) : accounts.isError ? (
        <LoadError error={accounts.error} retry={() => accounts.refetch()} />
      ) : list.length === 0 ? (
        <Panel className="mt-4">
          <EmptyState
            title="No accounts saved yet"
            body={unlocked ? "Add your Gmail, Facebook or any other login. The password is encrypted before it is stored." : "Unlock the vault to add your first account."}
            action={
              unlocked ? (
                <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                  Add an account
                </button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((group) => (
            <section key={group} aria-label={group}>
              <h2 className="mb-2 font-display text-lg font-semibold">
                {group} <span className="num text-sm font-normal text-ink-3">{list.filter((a) => a.category === group).length}</span>
              </h2>
              <ul className="space-y-2">
                {list
                  .filter((a) => a.category === group)
                  .map((account) => (
                    <AccountRow key={account.id} account={account} onEdit={() => setEditing(account)} onDelete={() => setDeleting(account)} />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {unlocked && (
        <div className="mt-8">
          <button type="button" className="text-sm text-ink-3 underline underline-offset-4" onClick={() => setResetting(true)}>
            Forgot your master password?
          </button>
        </div>
      )}

      <AccountDialog key={adding ? "add" : "add-closed"} open={adding} onClose={() => setAdding(false)} editing={null} />
      <AccountDialog key={editing ? `edit-${editing.id}` : "edit-closed"} open={editing !== null} onClose={() => setEditing(null)} editing={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title="Delete this account?"
        body={deleting && <><strong className="text-ink">{deleting.service}</strong> ({deleting.username}) and its saved password will be removed.</>}
        confirmLabel="Delete account"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={confirmDelete}
      />
      <ResetDialog open={resetting} onClose={() => setResetting(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------------------- setup */

function SetupPanel() {
  const session = useVaultSession();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  const setup = useMutation({
    mutationFn: api.vaultSetup,
    onSuccess: async (result) => {
      session.unlock(result.token, result.expires_in);
      setPassword("");
      setConfirm("");
      await Promise.all([
        client.invalidateQueries({ queryKey: [...queryKeys.vault, "status"] }),
        client.invalidateQueries({ queryKey: queryKeys.me }),
      ]);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 10) return setLocalError(new Error("Use at least 10 characters."));
    if (password !== confirm) return setLocalError(new Error("The two passwords don't match."));
    setLocalError(null);
    setup.mutate(password);
  }

  return (
    <Panel className="mx-auto max-w-lg">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-surface-2 ring-1 ring-inset ring-line">
          <KeyIcon size={22} />
        </span>
        <h2 className="font-display text-2xl font-semibold">Create your master password</h2>
      </div>
      <p className="mt-3 text-ink-2">
        Your passwords are encrypted with this master password before they reach the server. The server never sees it, so it can
        {" "}<strong className="text-ink">not</strong> be recovered if you forget it.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Master password" htmlFor="vs-pass" hint="At least 10 characters. A short sentence works well.">
          <input id="vs-pass" type="password" className="field" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm it" htmlFor="vs-confirm">
          <input id="vs-confirm" type="password" className="field" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" className="mt-1 size-4" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>I understand that if I forget it, my saved passwords are lost.</span>
        </label>
        <ErrorNote error={localError ?? setup.error} />
        <button type="submit" className="btn btn-primary w-full" disabled={!understood || setup.isPending}>
          {setup.isPending ? "Securing…" : "Create vault"}
        </button>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------------------- unlock */

function UnlockPanel({ onForgot }: { onForgot: () => void }) {
  const session = useVaultSession();
  const [password, setPassword] = useState("");
  const unlock = useMutation({
    mutationFn: api.vaultUnlock,
    onSuccess: (result) => {
      session.unlock(result.token, result.expires_in);
      setPassword("");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!unlock.isPending) unlock.mutate(password);
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Master password" htmlFor="vu-pass">
            <input id="vu-pass" type="password" className="field" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" disabled={unlock.isPending}>
          <UnlockIcon size={16} />
          {unlock.isPending ? "Unlocking…" : "Unlock"}
        </button>
      </form>
      <div className="mt-3 space-y-2">
        <ErrorNote error={unlock.error} />
        <button type="button" className="text-sm text-ink-3 underline underline-offset-4" onClick={onForgot}>
          Forgot your master password?
        </button>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------------- rows */

function AccountRow({ account, onEdit, onDelete }: { account: VaultAccount; onEdit: () => void; onDelete: () => void }) {
  const session = useVaultSession();
  const { copied, copy } = useCopy();
  const [revealed, setRevealed] = useState<{ password: string; notes: string | null } | null>(null);
  const [left, setLeft] = useState(0);
  const unlocked = session.token !== null;
  // Locking the vault hides everything at once.
  const secret = unlocked ? revealed : null;
  const setSecret = setRevealed;

  const reveal = useMutation({
    mutationFn: () => api.revealAccount(account.id, session.token as string),
    onSuccess: (result) => {
      setSecret(result);
      setLeft(REVEAL_SECONDS);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 423) session.lock();
    },
  });

  // Hide the password again after a few seconds, and whenever the vault locks.
  useEffect(() => {
    if (!secret) return;
    const timer = setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setSecret(null);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secret, setSecret]);

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold leading-snug">{account.service}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span className="break-all">{account.username}</span>
            <button type="button" className="btn btn-sm" aria-label={`Copy username for ${account.service}`} onClick={() => copy("user", account.username)}>
              <CopyIcon size={14} />
              {copied === "user" ? "Copied" : "Copy"}
            </button>
            {account.url && (
              <a href={account.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
                Open site <ExternalIcon size={13} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </p>
        </div>
        <span className="flex gap-1">
          <button type="button" className="btn btn-sm" aria-label={`Edit ${account.service}`} onClick={onEdit}>
            <PencilIcon size={15} />
          </button>
          <button type="button" className="btn btn-sm" aria-label={`Delete ${account.service}`} onClick={onDelete}>
            <TrashIcon size={15} />
          </button>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-inset ring-line">
        <span className="num min-w-0 flex-1 break-all text-sm" aria-live="polite">
          {secret ? secret.password : "••••••••••••"}
        </span>
        {secret ? (
          <>
            <span className="text-xs text-ink-3">Hides in {left}s</span>
            <button type="button" className="btn btn-sm" onClick={() => copy("pass", secret.password)}>
              <CopyIcon size={14} />
              {copied === "pass" ? "Copied" : "Copy"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSecret(null)}>
              <EyeOffIcon size={14} />
              Hide
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-sm" disabled={!unlocked || reveal.isPending} onClick={() => reveal.mutate()} title={unlocked ? undefined : "Unlock the vault first"}>
            <EyeIcon size={14} />
            {reveal.isPending ? "Decrypting…" : "Reveal"}
          </button>
        )}
      </div>
      {secret?.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-2">{secret.notes}</p>}
      {!secret && account.has_notes && <p className="mt-2 text-xs text-ink-3">Has encrypted notes. Reveal to read them.</p>}
      {reveal.isError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{reveal.error.message}</p>}
    </li>
  );
}

/* ----------------------------------------------------------------------------- dialogs */

function AccountDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: VaultAccount | null }) {
  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.service}` : "Add an account"}>
      <AccountForm onClose={onClose} editing={editing} />
    </Modal>
  );
}

function AccountForm({ onClose, editing }: { onClose: () => void; editing: VaultAccount | null }) {
  const session = useVaultSession();
  const client = useQueryClient();
  const [service, setService] = useState(editing?.service ?? "");
  const [username, setUsername] = useState(editing?.username ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [category, setCategory] = useState(editing?.category ?? "Email");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [original, setOriginal] = useState<{ password: string; notes: string } | null>(null);
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  const token = session.token;

  // When editing, load the current secret (the vault is unlocked) so notes can be edited.
  useEffect(() => {
    if (!editing || !token) return;
    let cancelled = false;
    api
      .revealAccount(editing.id, token)
      .then((s) => {
        if (cancelled) return;
        setOriginal({ password: s.password, notes: s.notes ?? "" });
        setNotes(s.notes ?? "");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 423) session.lock();
      });
    return () => {
      cancelled = true;
    };
  }, [editing, token, session]);

  const save = useMutation({
    mutationFn: async () => {
      const details = { service: service.trim(), username: username.trim(), url: url.trim() || null, category: category.trim() || "Other" };
      if (!editing) {
        if (!token) throw new ApiError(423, "The vault is locked. Unlock it first.");
        return api.createAccount({ ...details, password, notes: notes.trim() || null }, token);
      }
      await api.updateAccount(editing.id, details);
      const secretChanged = password !== "" || (original !== null && notes.trim() !== original.notes.trim());
      if (secretChanged && token && original) {
        return api.updateSecret(editing.id, { password: password || original.password, notes: notes.trim() || null }, token);
      }
      return editing;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [...queryKeys.vault, "accounts"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 423) session.lock();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing && !password) return setLocalError(new Error("Enter the password to save."));
    setLocalError(null);
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service" htmlFor="ac-service">
          <input id="ac-service" className="field" required maxLength={80} placeholder="Gmail" value={service} onChange={(e) => setService(e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="ac-category">
          <input id="ac-category" className="field" list="ac-categories" required maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="ac-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Username or email" htmlFor="ac-user">
        <input id="ac-user" className="field" required maxLength={120} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label="Website (optional)" htmlFor="ac-url">
        <input id="ac-url" type="url" inputMode="url" className="field" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label={editing ? "New password" : "Password"} htmlFor="ac-pass" hint={editing ? "Leave blank to keep the current password." : undefined}>
        <div className="flex gap-2">
          <input
            id="ac-pass"
            type={show ? "text" : "password"}
            className="field num"
            autoComplete="new-password"
            maxLength={500}
            required={!editing}
            disabled={editing !== null && !token}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="btn" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
            {show ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPassword(generatePassword());
              setShow(true);
            }}
          >
            Generate
          </button>
        </div>
      </Field>
      {(!editing || token) && (
        <Field label="Notes (optional, encrypted)" htmlFor="ac-notes">
          <textarea id="ac-notes" className="field" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      )}
      <ErrorNote error={localError ?? save.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : editing ? "Save changes" : "Save account"}
        </button>
      </DialogActions>
    </form>
  );
}

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Reset the vault">
      <ResetForm onClose={onClose} />
    </Modal>
  );
}

function ResetForm({ onClose }: { onClose: () => void }) {
  const session = useVaultSession();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const reset = useMutation({
    mutationFn: api.vaultReset,
    onSuccess: async () => {
      session.lock();
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.vault }),
        client.invalidateQueries({ queryKey: queryKeys.me }),
      ]);
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    reset.mutate(password);
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-4">
      <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
        This permanently deletes every saved account and password. Passwords can&apos;t be recovered without the master password. You
        can then create a new master password.
      </p>
      <Field label="Your account password" htmlFor="rs-pass" hint="The one you use to sign in, to confirm it's you.">
        <input id="rs-pass" type="password" className="field" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <ErrorNote error={reset.error} />
      <DialogActions>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-danger" disabled={reset.isPending}>
          {reset.isPending ? "Deleting…" : "Delete everything and reset"}
        </button>
      </DialogActions>
    </form>
  );
}
