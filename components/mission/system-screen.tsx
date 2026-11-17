import { Backdrop } from "./backdrop";
import { BrandMark } from "./brand";

export function SystemScreen({ title, detail, pending = false, children }: { title: string; detail?: string; pending?: boolean; children?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center" data-phase="standby">
      <Backdrop intensity="calm" />
      <div className="relative z-10 flex max-w-xl flex-col items-center">
        <BrandMark className={pending ? "pulse-soft h-16 w-16" : "h-16 w-16"} />
        <h1 className="mt-6 font-display text-xl font-semibold tracking-[0.25em] text-sky-50">{title}</h1>
        {detail && <p className="mt-3 text-sm text-sky-100/60">{detail}</p>}
        {children}
      </div>
    </div>
  );
}
