/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // dark/sporty accent palette
        accent: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        surface: {
          900: "#0a0f14",
          800: "#111827",
          700: "#1f2937",
          600: "#374151",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
