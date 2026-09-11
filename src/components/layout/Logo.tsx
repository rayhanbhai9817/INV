import { cn } from "@/lib/utils";

export interface LogoProps {
  /** Rendered height of the mark in pixels. Width follows the aspect ratio. */
  height?: number;
  className?: string;
  title?: string;
}

/**
 * Ozipco brand mark: crimson pill outline around the lowercase wordmark.
 * Drawn as an SVG so it stays sharp at every size and needs no image asset.
 */
export function Logo({ height = 32, className, title = "Ozipco" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 260 96"
      height={height}
      width={(height * 260) / 96}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>
      <rect
        x="5"
        y="5"
        width="250"
        height="86"
        rx="43"
        ry="43"
        fill="none"
        stroke="#be1e2d"
        strokeWidth="10"
      />
      <text
        x="130"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#be1e2d"
        fontSize="54"
        fontWeight="700"
        letterSpacing="-1"
        fontFamily="'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif"
      >
        ozipco
      </text>
    </svg>
  );
}

/** Square lockup for favicons and tight spaces — the "o" inside the pill. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label="Ozipco"
      className={cn("shrink-0", className)}
    >
      <rect
        x="5"
        y="5"
        width="86"
        height="86"
        rx="30"
        ry="30"
        fill="none"
        stroke="#be1e2d"
        strokeWidth="9"
      />
      <text
        x="48"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#be1e2d"
        fontSize="52"
        fontWeight="700"
        fontFamily="'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif"
      >
        o
      </text>
    </svg>
  );
}
