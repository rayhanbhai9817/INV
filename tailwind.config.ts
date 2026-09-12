import type { Config } from "tailwindcss";

/**
 * Palette and radii mirror the reference design system one-for-one, so a class
 * written against the reference maps straight onto this project.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f4f7fe",
        foreground: "#2b3674",
        card: "#ffffff",
        line: "#e0e5f2",
        mutedfg: "#a3aed0",

        primary: {
          DEFAULT: "#4318ff",
          soft: "#b195ff",
        },
        success: "#05cd99",
        warning: "#ffb547",
        danger: "#ee5d50",

        sidebar: {
          DEFAULT: "#0b1437",
          accent: "#1e293b",
        },

        /**
         * The shared UI kit (Button, Input, Badge, …) was written against a
         * `brand` scale. Without it those classes compile to nothing, which
         * left every primary button white-on-white and every focus ring dead.
         * The shades map onto the palette this project already uses: 600 is
         * the primary and 700 its hover, exactly as the redesigned pages
         * spell them literally.
         */
        brand: {
          50: "#f2efff",
          100: "#e0d9ff",
          200: "#c4b5ff",
          500: "#5a35ff",
          600: "#4318ff",
          700: "#3311cc",
        },

        /** Aliases kept so existing markup keeps compiling. */
        canvas: "#f4f7fe",
        navy: {
          950: "#0b1437",
          900: "#0b1437",
          800: "#2b3674",
          700: "#2b3674",
          600: "#4318ff",
          500: "#707eae",
          300: "#a3aed0",
          200: "#e0e5f2",
        },
      },
      borderRadius: {
        sm: "calc(0.75rem - 4px)",
        md: "calc(0.75rem - 2px)",
        lg: "0.75rem",
      },
      fontFamily: {
        // Baloo Da 2, loaded in src/app/layout.tsx. Times stays behind it as
        // the fallback, which is also what the whole app used before.
        sans: ["var(--font-baloo)", '"Times New Roman"', "Times", "serif"],
        serif: ["var(--font-baloo)", '"Times New Roman"', "Times", "serif"],
        mono: ["var(--font-baloo)", '"Times New Roman"', "Times", "serif"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
