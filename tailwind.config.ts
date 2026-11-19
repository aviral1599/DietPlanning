import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// shadcn/ui colour tokens. The CSS variables behind them are only defined inside
// the client portal (`.portal` in src/app/portal/portal.css), so these classes
// do nothing on the coach dashboard.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

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
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};

export default config;
