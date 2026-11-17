import Link from "next/link";
import { MonitorPlay, Smartphone, LayoutDashboard, Gauge } from "lucide-react";
import { Backdrop } from "@/components/mission/backdrop";
import { BrandMark } from "@/components/mission/brand";

const LINKS = [
  { href: "/timer/projector", title: "Projector", body: "Cinematic mission clock for the main stage.", icon: MonitorPlay },
  { href: "/timer/projector?mode=minimal", title: "Minimal", body: "High-contrast digits for side screens.", icon: Gauge },
  { href: "/timer", title: "Participant", body: "Mobile timer — share via QR.", icon: Smartphone },
  { href: "/admin/timer", title: "Mission Control", body: "Host dashboard. Sign-in required.", icon: LayoutDashboard },
];

export default function Home() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16" data-phase="charged">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center text-center">
        <BrandMark className="h-20 w-20" />
        <div className="eyebrow mt-8">The official mission clock</div>
        <h1 className="mt-4 font-display text-[clamp(2.2rem,7vw,5.5rem)] font-bold leading-none tracking-[0.12em] text-white glow-text">DESIGNATHON X</h1>
        <div className="mt-4 font-display text-[clamp(1rem,2.6vw,2rem)] font-semibold tracking-[0.6em] text-energy">THE FINAL 12</div>
        <p className="mt-6 max-w-xl text-sky-100/70">12 Hours. One Mission. Infinite Possibilities.</p>
        <div className="mt-12 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LINKS.map(({ href, title, body, icon: Icon }) => (
            <Link key={href} href={href} className="glass group rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40">
              <Icon className="h-5 w-5 text-energy" />
              <div className="mt-4 font-display text-sm font-semibold tracking-[0.2em] text-white">{title}</div>
              <div className="mt-1.5 text-sm text-sky-100/60">{body}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
