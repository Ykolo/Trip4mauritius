import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#06B6D4",
          light: "#22D3EE",
        },
        accent: {
          DEFAULT: "#D4AF37",
        },
        surface: "#FFFFFF",
        muted: "#6B7280",
        base: "#FAFAF7",
        ink: "#1A1A2E",
      },
      fontFamily: {
        display: ["var(--font-pacifico)", "Pacifico", "cursive"],
        body: ["var(--font-poppins)", "Poppins", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1rem",
        card: "1rem",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
