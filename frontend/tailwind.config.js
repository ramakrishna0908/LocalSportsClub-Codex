/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf8ef",
          100: "#f9edcf",
          200: "#f2d89e",
          300: "#e8c06a",
          400: "#d4a23e",
          500: "#c08a22",
          600: "#a0701a",
          700: "#805818",
          800: "#5a4020",
          900: "#3a2810",
          950: "#1a1410",
        },
        surface: {
          0: "#121010",
          50: "#1a1614",
          100: "#1e1a16",
          200: "#2a2520",
          300: "#3a3530",
          400: "#4a4238",
          500: "#6b6155",
          600: "#8a7e6b",
          700: "#a89880",
          800: "#c4b5a0",
          900: "#f5f0e8",
        },
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["Source Sans 3", "Helvetica Neue", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
