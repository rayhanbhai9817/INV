import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TileTone = "indigo" | "green" | "red" | "amber" | "navy";

const ICON_TONES: Record<TileTone, string> = {
  indigo: "bg-primary/10 text-primary",
  green: "bg-success/10 text-success",
  red: "bg-danger/10 text-danger",
  amber: "bg-warning/10 text-warning",
  navy: "bg-navy-900/5 text-navy-700",
};

const VALUE_TONES: Record<TileTone, string> = {
  indigo: "text-navy-800",
  green: "text-success",
  red: "text-danger",
  amber: "text-warning",
  navy: "text-navy-800",
};

/** Small uppercase caption used across the dashboard cards. */
export function TileLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-300",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-navy-200/50 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,64,0.04)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Metric tile: caption, big serif value with a unit, sub-caption and a link. */
export function StatTile({
  label,
  value,
  unit,
  caption,
  href,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  href?: string;
  icon?: ReactNode;
  tone?: TileTone;
}) {
  return (
    <Panel className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TileLabel>{label}</TileLabel>
          <p className="mt-3 font-serif text-[26px] font-bold leading-none tracking-tight">
            <span className={VALUE_TONES[tone]}>{value}</span>
            {unit && (
              <span className="ml-1.5 font-serif text-[13px] font-semibold text-navy-500">
                {unit}
              </span>
            )}
          </p>
        </div>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              ICON_TONES[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="mt-4">
        {caption && <p className="text-[11px] text-navy-300">{caption}</p>}
        {href && (
          <Link
            href={href}
            className="mt-1.5 inline-block text-[11px] font-medium text-navy-500 transition hover:text-primary"
          >
            View all →
          </Link>
        )}
      </div>
    </Panel>
  );
}
