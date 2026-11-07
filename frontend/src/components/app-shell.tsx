"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import {
  BookIcon,
  CalendarCheckIcon,
  FlameIcon,
  DotsIcon,
  GearIcon,
  HomeIcon,
  LockIcon,
  LogoutIcon,
  SparkIcon,
  StarIcon,
  SwapIcon,
  WalletIcon,
} from "./icons";
import { Logo } from "./logo";
import { SettingsDialog } from "./settings-dialog";
import { Loading, Modal } from "./ui";

const NAV = [
  { href: "/overview", label: "Overview", icon: HomeIcon },
  { href: "/money", label: "Money", icon: WalletIcon },
  { href: "/bills", label: "Monthly", icon: CalendarCheckIcon },
  { href: "/loans", label: "Lend & borrow", icon: SwapIcon },
  { href: "/books", label: "Books", icon: BookIcon },
  { href: "/dates", label: "Dates", icon: StarIcon },
  { href: "/learn", label: "Learn", icon: SparkIcon },
  { href: "/challenges", label: "Challenges", icon: FlameIcon },
  { href: "/vault", label: "Vault", icon: LockIcon },
] as const;

const PRIMARY_MOBILE = NAV.slice(0, 4);

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The sheet is tied to the route it was opened on, so navigating closes it without an effect.
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null);

  const signedOut = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  const moreOpen = moreOpenAt === pathname;
  const setMoreOpen = (open: boolean) => setMoreOpenAt(open ? pathname : null);

  async function signOut() {
    try {
      await api.logout();
    } finally {
      client.clear();
      router.replace("/login");
    }
  }

  if (me.isPending || signedOut) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loading label="Opening your books" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <div>
          <p className="font-display text-2xl font-semibold">Can&rsquo;t reach the server</p>
          <p className="mt-1 text-ink-2">{me.error.message}</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => me.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const user = me.data;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = NAV.slice(PRIMARY_MOBILE.length).some((item) => isActive(item.href));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2">
          <Logo href="/overview" />
        </div>
        <nav aria-label="Main" className="mt-8 flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-lg px-3 font-semibold transition-colors ${
                isActive(href) ? "bg-accent text-[#0a0a0a]" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line pt-3">
          <p className="truncate px-2 text-sm font-semibold">{user.name}</p>
          <p className="truncate px-2 text-sm text-ink-3">{user.email}</p>
          <div className="mt-2 flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
              <GearIcon />
            </button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Sign out" onClick={signOut}>
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-2 backdrop-blur lg:hidden">
          <Logo href="/overview" />
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {PRIMARY_MOBILE.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${
              isActive(href) ? "text-ink" : "text-ink-3"
            }`}
          >
            <Icon size={21} strokeWidth={isActive(href) ? 2.4 : 1.8} />
            {label === "Lend & borrow" ? "Loans" : label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${
            moreActive ? "text-ink" : "text-ink-3"
          }`}
        >
          <DotsIcon size={21} />
          More
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="mt-4 grid gap-1">
          {NAV.slice(PRIMARY_MOBILE.length).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold hover:bg-surface-2"
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
          <button
            type="button"
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-surface-2"
            onClick={() => {
              setMoreOpen(false);
              setSettingsOpen(true);
            }}
          >
            <GearIcon size={20} />
            Settings
          </button>
          <button
            type="button"
            className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-left font-semibold hover:bg-surface-2"
            onClick={signOut}
          >
            <LogoutIcon size={20} />
            Sign out
            <span className="ml-auto truncate text-sm font-normal text-ink-3">{user.email}</span>
          </button>
        </div>
      </Modal>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

