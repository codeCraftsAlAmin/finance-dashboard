"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface VaultSession {
  token: string | null;
  /** Seconds until the vault locks itself again; null while locked. */
  secondsLeft: number | null;
  unlock: (token: string, expiresIn: number) => void;
  lock: () => void;
}

const Ctx = createContext<VaultSession | null>(null);

/**
 * The unlock token lives in memory only: a refresh or closing the tab locks the vault.
 * It also expires server-side after ten minutes, so a forgotten tab locks itself.
 */
export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const lock = useCallback(() => {
    setToken(null);
    setExpiresAt(null);
  }, []);

  const unlock = useCallback((next: string, expiresIn: number) => {
    setToken(next);
    setNow(Date.now());
    setExpiresAt(Date.now() + expiresIn * 1000);
  }, []);

  useEffect(() => {
    if (expiresAt === null) return;
    timer.current = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= expiresAt) lock();
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [expiresAt, lock]);

  const secondsLeft = expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const value = useMemo(() => ({ token, secondsLeft, unlock, lock }), [token, secondsLeft, unlock, lock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVaultSession() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useVaultSession must be used inside VaultSessionProvider");
  return value;
}
