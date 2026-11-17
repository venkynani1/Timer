const TZ = process.env.NEXT_PUBLIC_EVENT_TIMEZONE || undefined;

export function formatClockTime(ms: number | null, opts: { seconds?: boolean } = {}) {
  if (ms === null) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: opts.seconds ? "2-digit" : undefined,
    hour12: false,
    timeZone: TZ,
  }).format(ms);
}

export function formatDateTime(ms: number | null) {
  if (ms === null) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: TZ,
    timeZoneName: "short",
  }).format(ms);
}

export function formatPercent(p: number) {
  const v = Math.min(100, Math.max(0, p * 100));
  return v >= 99.95 && p < 1 ? "99.9" : v.toFixed(1);
}

export function formatCompact(ms: number) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
