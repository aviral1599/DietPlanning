import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf6",
          100: "#d6f7e6",
          200: "#b0edd0",
          300: "#7bddb3",
          400: "#43c491",
          500: "#1fa974",
          600: "#12885d",
          700: "#106c4d",
          800: "#11563f",
          900: "#0f4735",
          950: "#04281e",
        },
        accent: {
          500: "#e2622a",
          600: "#c94f1c",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
