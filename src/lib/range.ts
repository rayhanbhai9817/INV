/**
 * Date-range presets for the dashboard, ledger and report filters.
 * Labels and boundaries mirror the reference implementation exactly.
 */

export interface DateRange {
  from: string;
  to: string;
  label: string;
  details: string;
}

const longDate = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const mediumDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export function rangeFor(preset: string, from?: string, to?: string): DateRange {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let label = "Activity";
  let details = "All Time";

  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      label = "Today";
      details = longDate.format(now);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      label = "Yesterday";
      details = longDate.format(start);
      break;
    case "last-7-days":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      label = "Last 7 Days";
      details = `${shortDay.format(start)} – ${mediumDate.format(now)}`;
      break;
    case "this-week": {
      const day = (start.getDay() + 6) % 7; // Monday start
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      label = "This Week";
      details = `${shortDay.format(start)} – ${mediumDate.format(now)}`;
      break;
    }
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      label = "This Month";
      details = monthYear.format(now);
      break;
    case "prev-month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      label = "Previous Month";
      details = monthYear.format(start);
      break;
    case "last-30-days":
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      label = "Last 30 Days";
      details = `${shortDay.format(start)} – ${mediumDate.format(now)}`;
      break;
    case "this-year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      label = "This Year";
      details = String(now.getFullYear());
      break;
    case "custom":
      label = "Custom Range";
      details =
        from && to
          ? `${mediumDate.format(new Date(from))} – ${mediumDate.format(new Date(to))}`
          : "Selected Period";
      return {
        from: from ? new Date(from).toISOString() : new Date(0).toISOString(),
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : end.toISOString(),
        label,
        details,
      };
    default:
      return {
        from: new Date(0).toISOString(),
        to: end.toISOString(),
        label: "All Time",
        details: "Complete Inventory History",
      };
  }

  return { from: start.toISOString(), to: end.toISOString(), label, details };
}

export function rangeForMonth(year: number, month: number): DateRange {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    label: "Monthly Summary",
    details: monthYear.format(start),
  };
}

export type StockStatusLabel = "IN STOCK" | "LOW STOCK" | "OUT OF STOCK";

export function stockStatusLabel(totalUnits: number, thresholdUnits: number): StockStatusLabel {
  const units = Math.max(0, totalUnits || 0);
  const threshold = Math.max(0, thresholdUnits || 0);
  if (units <= 0) return "OUT OF STOCK";
  if (units <= threshold) return "LOW STOCK";
  return "IN STOCK";
}
