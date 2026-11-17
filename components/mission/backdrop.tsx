import { memo } from "react";

// Deterministic pseudo-random so server and client markup match.
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  left: `${(rand(i + 1) * 100).toFixed(2)}%`,
  top: `${(55 + rand(i + 101) * 50).toFixed(2)}%`,
  dur: `${(14 + rand(i + 201) * 18).toFixed(1)}s`,
  delay: `${(-rand(i + 301) * 30).toFixed(1)}s`,
  dx: `${((rand(i + 401) - 0.5) * 120).toFixed(0)}px`,
  size: rand(i + 501) > 0.85 ? 3 : 2,
}));

/** Atmosphere: radial nebula, perspective grid floor, ambient particles, vignette. */
export const Backdrop = memo(function Backdrop({ intensity = "full" }: { intensity?: "full" | "calm" | "none" }) {
  if (intensity === "none") return <div className="pointer-events-none fixed inset-0 bg-[#01040b]" aria-hidden />;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 45%, hsl(var(--e-glow) / 0.13), transparent 70%)," +
            "radial-gradient(ellipse 45% 40% at 85% 10%, hsl(262 90% 60% / 0.12), transparent 70%)," +
            "radial-gradient(ellipse 40% 35% at 10% 90%, hsl(215 100% 55% / 0.10), transparent 70%)," +
            "linear-gradient(180deg, #030817 0%, #040b1f 55%, #020611 100%)",
        }}
      />
      <div className="grid-floor opacity-60" />
      {intensity === "full" &&
        PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{ left: p.left, top: p.top, animationDuration: p.dur, animationDelay: p.delay, width: p.size, height: p.size, ["--dx" as string]: p.dx }}
          />
        ))}
      <div className="scanlines absolute inset-0 opacity-60" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(1,3,10,0.85) 100%)" }} />
    </div>
  );
});
