"use client";

import { useCallback, useState } from "react";

export async function adminFetch<T = unknown>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Tracks busy / error / success for an admin action. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const r = await fn();
      if (success) setOk(success);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, ok, run, setError };
}

export function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p className="text-sm text-red-300" role="alert">{error}</p>;
  if (ok) return <p className="text-sm text-emerald-300" role="status">{ok}</p>;
  return null;
}
