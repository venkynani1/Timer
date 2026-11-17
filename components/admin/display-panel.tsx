"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, ExternalLink, Gauge, LayoutDashboard, MonitorPlay, Check, Download } from "lucide-react";
import type { MissionView } from "@/hooks/use-mission";
import type { DisplayMode } from "@/lib/timer/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { adminFetch, Feedback, useAction } from "./api-client";

const MODES: Array<{ id: DisplayMode; title: string; body: string; icon: typeof MonitorPlay }> = [
  { id: "cinematic", title: "Cinematic", body: "Main projector: energy ring, ambient effects, transitions.", icon: MonitorPlay },
  { id: "minimal", title: "Minimal", body: "Huge high-contrast digits. No animation.", icon: Gauge },
  { id: "command", title: "Command", body: "Timer, schedule, broadcast queue and health.", icon: LayoutDashboard },
];

export function DisplayPanel({ m, slug }: { m: MissionView; slug: string }) {
  const clock = m.bundle!.clock;
  const action = useAction();
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const eventQuery = slug === (process.env.NEXT_PUBLIC_EVENT_SLUG || "designathon-x") ? "" : `?event=${slug}`;
  const publicUrl = `${origin}/timer${eventQuery}`;
  const projectorUrl = `/timer/projector${eventQuery}`;

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(publicUrl, { margin: 1, width: 512, color: { dark: "#020611", light: "#ffffff" }, errorCorrectionLevel: "M" }).then(setQr, () => setQr(null));
  }, [origin, publicUrl]);

  const configure = (patch: Record<string, unknown>, msg: string) =>
    action.run(async () => {
      await adminFetch("/api/admin/timer/configure", "POST", { event: slug, ...patch });
      m.refresh();
    }, msg);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Projector layout</CardTitle>
          <CardDescription>Switches every projector that isn&apos;t pinned with ?mode=. The timer state is never affected.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map(({ id, title, body, icon: Icon }) => (
              <button
                key={id}
                onClick={() => configure({ displayMode: id }, `Projectors switched to ${title}.`)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  clock.displayMode === id ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-white/[0.02] hover:border-white/25",
                )}
                aria-pressed={clock.displayMode === id}
              >
                <Icon className="h-5 w-5 text-energy" />
                <div className="mt-3 font-display text-xs font-semibold tracking-[0.2em]">{title}</div>
                <div className="mt-1 text-xs text-sky-100/60">{body}</div>
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="eyebrow text-[0.6rem]">Live preview</span>
              <a href={projectorUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-xs text-cyan-300 hover:underline">
                Open fullscreen projector <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <iframe
                title="Projector preview"
                src={`${projectorUrl}${eventQuery ? "&" : "?"}embed=1`}
                className="absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-[0.25] border-0"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div>
              <div className="font-display text-xs font-semibold tracking-[0.2em]">Sound effects</div>
              <div className="mt-1 text-xs text-sky-100/60">Launch, phase chimes, final-10-second ticks and completion. Each screen still needs one click to unmute (browser autoplay rules).</div>
            </div>
            <Switch checked={clock.soundEnabled} onCheckedChange={(v) => configure({ soundEnabled: v }, v ? "Sound effects enabled." : "Sound effects disabled.")} aria-label="Sound effects" />
          </div>
          <Feedback error={action.error} ok={action.ok} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant timer</CardTitle>
          <CardDescription>Public, read-only. No sign-in required.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={`QR code for ${publicUrl}`} className="h-56 w-56" /> : <div className="h-56 w-56" />}
          </div>
          <code className="w-full truncate rounded-md bg-midnight-950/70 px-3 py-2 text-center text-xs text-sky-100/80">{publicUrl}</code>
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                await navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
            </Button>
            {qr && (
              <Button variant="outline" asChild className="flex-1">
                <a href={qr} download="designathon-x-timer-qr.png"><Download /> QR image</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
