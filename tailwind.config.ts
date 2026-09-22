import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        cairo: ["Cairo", "Tajawal", "system-ui", "sans-serif"],
        tajawal: ["Tajawal", "Cairo", "system-ui", "sans-serif"],
        system: ["system-ui", "Segoe UI", "Tahoma", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0faf8",
          100: "#dcf0ec",
          200: "#bce0d8",
          300: "#8fc9bc",
          500: "#14806f",
          600: "#0f766e",
          700: "#115e59",
          900: "#134e4a",
          950: "#0b2e2b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
