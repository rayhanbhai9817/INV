import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile presentation for the wide data tables.
 *
 * Every table in this app is built for a desktop width, so on a phone it can
 * only be read by scrolling sideways. Each table therefore ships a second
 * rendering: the table itself is hidden below `md`, and these stacked cards
 * take over, carrying the same columns as label/value pairs.
 */

export interface CardField {
  label: string;
  value: ReactNode;
  /** Tailwind text colour for the value, e.g. "text-[#05cd99]". */
  tone?: string;
  /** Give the field the full row instead of half. */
  wide?: boolean;
}

export function MobileCards({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-[#f4f7fe] md:hidden", className)}>{children}</div>
  );
}

export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  footer,
  onClick,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  fields?: CardField[];
  actions?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") onClick?.();
            }
          : undefined
      }
      className={cn("px-4 py-4", interactive && "cursor-pointer", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-[#2b3674]">{title}</p>
          {subtitle && (
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              {subtitle}
            </p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {fields && fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {fields.map((field, index) => (
            <div key={index} className={cn(field.wide && "col-span-2")}>
              <dt className="text-[9px] font-black uppercase tracking-[0.15em] text-[#a3aed0]">
                {field.label}
              </dt>
              <dd className={cn("mt-0.5 text-sm font-black", field.tone ?? "text-[#2b3674]")}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {footer && <div className="mt-3">{footer}</div>}

      {actions && <div className="mt-3 flex items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}

/** Empty / loading / error blocks sized for both layouts. */
export function StateBlock({
  icon,
  title,
  message,
  action,
  tone = "muted",
}: {
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm",
        tone === "danger" ? "text-[#ee5d50]" : "text-[#a3aed0]",
      )}
    >
      {icon}
      <span>{title}</span>
      {message && <span className="max-w-md text-xs">{message}</span>}
      {action}
    </div>
  );
}
