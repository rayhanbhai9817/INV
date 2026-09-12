import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /** Accent — warm orange. Used for primary actions and active states. */
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        /** Sidebar surface. */
        shell: {
          900: "#111827",
          800: "#1f2937",
          700: "#374151",
        },
        /** Deep navy used by the app shell and headings. */
        navy: {
          950: "#0a1030",
          900: "#0e1638",
          800: "#151f4a",
          700: "#1d2a63",
          600: "#26357c",
          500: "#3a4a96",
          300: "#8f9cc9",
          200: "#c2cae6",
        },
        /** Page ground. */
        canvas: "#f4f6fc",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
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
