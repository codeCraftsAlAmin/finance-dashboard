"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { browserTimeZone } from "@/lib/format";
import { queryKeys, useMe } from "@/lib/hooks";
import { Logo } from "./logo";
import { ErrorNote, Field } from "./ui";

type Mode = "login" | "register";

const COPY = {
  login: {
    title: "Welcome back",
    lead: "Open your books where you left them.",
    submit: "Sign in",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/register",
  },
  register: {
    title: "Start your ledger",
    lead: "Free, private, and ready in under a minute.",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Sign in",
    switchHref: "/login",
  },
} as const;

/** A made-up page of the ledger, so the first screen shows what the product is for. */
function LedgerSample() {
  const rows: [string, string, boolean][] = [
    ["Tuition · Nov", "+৳3,000", true],
    ["Books", "−৳850", false],
    ["Wifi bill", "−৳600", false],
    ["Tutor fee", "−৳400", false],
  ];
  return (
    <div aria-hidden="true" className="ledger-margin panel w-full max-w-sm bg-surface py-5 pl-9 pr-5">
      <p className="font-display text-sm text-ink-3">November</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map(([label, amount, income]) => (
          <li key={label} className="flex items-baseline gap-2 text-[0.95rem]">
            <span>{label}</span>
            <span className="leader" />
            <span className={`num font-semibold ${income ? "text-good" : ""}`}>{amount}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-line-strong pt-3">
        <span className="font-semibold">Left this month</span>
        <span className="num border-b-[3px] border-double border-ink text-2xl font-semibold">৳1,150</span>
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Someone who is already signed in has no reason to be here.
  useEffect(() => {
    if (me.data) router.replace("/overview");
  }, [me.data, router]);

  const submit = useMutation({
    mutationFn: () =>
      mode === "login"
        ? api.login(email.trim(), password)
        : api.register({ name: name.trim(), email: email.trim(), password, timezone: browserTimeZone() }),
    onSuccess: (user) => {
      // Next keeps the previous route mounted (hidden) after navigating, so don't leave
      // credentials sitting in its form state.
      setName("");
      setEmail("");
      setPassword("");
      client.setQueryData(queryKeys.me, user);
      router.replace("/overview");
    },
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!submit.isPending) submit.mutate();
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-surface p-10 lg:flex">
        <Logo />
        <div className="space-y-8">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">
            Every taka, book, bill and birthday in one place.
          </h2>
          <LedgerSample />
        </div>
        <p className="text-sm text-ink-3">Your passwords are encrypted with a key only you hold.</p>
      </div>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-ink-2">{copy.lead}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Name" htmlFor="name">
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
              </Field>
            )}
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                maxLength={72}
                required
              />
            </Field>
            <ErrorNote error={submit.error} />
            <button type="submit" className="btn btn-primary w-full" disabled={submit.isPending}>
              {submit.isPending ? "Please wait…" : copy.submit}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-2">
            {copy.switchText}{" "}
            <Link href={copy.switchHref} className="font-semibold text-ink underline underline-offset-4">
              {copy.switchLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
