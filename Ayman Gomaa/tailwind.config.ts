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
          50: "#eefbf3",
          100: "#d7f5e2",
          500: "#16a34a",
          600: "#15803d",
          700: "#166534",
        },
      },
    },
  },
  plugins: [],
};

export default config;
