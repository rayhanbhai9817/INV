import { cn } from "@/lib/utils";

/** Colour treatments for the mark, so it works on light and dark surfaces. */
export type LogoTone = "brand" | "light" | "onAccent";

const TONE_COLOR: Record<LogoTone, string> = {
  brand: "#be1e2d",
  light: "#ffffff",
  onAccent: "#ffffff",
};

const WORDMARK_FONT = "'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif";

export interface LogoProps {
  /** Rendered height of the mark in pixels. Width follows the aspect ratio. */
  height?: number;
  tone?: LogoTone;
  className?: string;
  title?: string;
}

/** Ozipco wordmark: pill outline around the lowercase logotype. */
export function Logo({ height = 32, tone = "brand", className, title = "Ozipco" }: LogoProps) {
  const color = TONE_COLOR[tone];

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
        stroke={color}
        strokeWidth="10"
      />
      <text
        x="130"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="54"
        fontWeight="700"
        letterSpacing="-1"
        fontFamily={WORDMARK_FONT}
      >
        ozipco
      </text>
    </svg>
  );
}

/** Square lockup for favicons, the collapsed sidebar rail and tight spaces. */
export function LogoMark({
  size = 36,
  tone = "brand",
  className,
}: {
  size?: number;
  tone?: LogoTone;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  // On the orange accent tile the outline would fight the background, so the
  // letter alone carries the mark.
  const showOutline = tone !== "onAccent";

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label="Ozipco"
      className={cn("shrink-0", className)}
    >
      {showOutline && (
        <rect
          x="5"
          y="5"
          width="86"
          height="86"
          rx="30"
          ry="30"
          fill="none"
          stroke={color}
          strokeWidth="9"
        />
      )}
      <text
        x="48"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={showOutline ? "52" : "64"}
        fontWeight="700"
        fontFamily={WORDMARK_FONT}
      >
        o
      </text>
    </svg>
  );
}
