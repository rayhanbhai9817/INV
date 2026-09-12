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
        sans: ['"Times New Roman"', "Times", "serif"],
        serif: ['"Times New Roman"', "Times", "serif"],
        mono: ['"Times New Roman"', "Times", "serif"],
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
