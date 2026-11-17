import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-tech text-[0.7rem] font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
        violet: "border-violet-300/30 bg-violet-400/10 text-violet-200",
        success: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
        warning: "border-amber-300/30 bg-amber-400/10 text-amber-200",
        danger: "border-red-300/40 bg-red-500/15 text-red-200",
        muted: "border-white/10 bg-white/5 text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
