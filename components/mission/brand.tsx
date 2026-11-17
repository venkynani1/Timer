import { cn } from "@/lib/utils";

/** Designathon X mark: an orbit ring crossed by an "X" of two energy blades. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-10 w-10", className)} aria-hidden="true">
      <defs>
        <linearGradient id="bm-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22e4ff" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="bm-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#22e4ff" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="none" stroke="url(#bm-a)" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="url(#bm-b)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 4" />
      <path d="M18 16 L28 16 L46 48 L36 48 Z" fill="url(#bm-a)" />
      <path d="M46 16 L36 16 L18 48 L28 48 Z" fill="url(#bm-b)" fillOpacity="0.85" />
      <circle cx="32" cy="32" r="3" fill="#e0fbff" />
    </svg>
  );
}

export function BrandLockup({ name, subtitle, className, compact = false }: { name: string; subtitle: string; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={compact ? "h-8 w-8" : "h-11 w-11"} />
      <div className="text-left leading-none">
        <div className={cn("font-display font-bold tracking-[0.28em] text-sky-50", compact ? "text-sm" : "text-lg")}>{name}</div>
        <div className={cn("mt-1.5 font-tech font-semibold tracking-[0.42em] text-energy", compact ? "text-[0.6rem]" : "text-xs")}>{subtitle}</div>
      </div>
    </div>
  );
}
