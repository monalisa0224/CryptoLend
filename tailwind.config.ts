import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface-0) / <alpha-value>)",
        "surface-soft": "hsl(var(--surface-1) / <alpha-value>)",
        "surface-muted": "hsl(var(--surface-2) / <alpha-value>)",
        "border-subtle": "hsl(var(--border-subtle) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        text: "hsl(var(--text-primary) / <alpha-value>)",
        "text-soft": "hsl(var(--text-secondary) / <alpha-value>)",
        "text-muted": "hsl(var(--text-tertiary) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-strong": "hsl(var(--accent-strong) / <alpha-value>)",
        "accent-soft": "hsl(var(--accent-soft) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        "success-soft": "hsl(var(--success-soft) / <alpha-value>)",
        "success-border": "hsl(var(--success-border) / <alpha-value>)",
        "warning-soft": "hsl(var(--warning-soft) / <alpha-value>)",
        "warning-border": "hsl(var(--warning-border) / <alpha-value>)",
        "danger-soft": "hsl(var(--danger-soft) / <alpha-value>)",
        "danger-border": "hsl(var(--danger-border) / <alpha-value>)",
      },
      fontSize: {
        "fluid-hero": "var(--step-3)",
        "fluid-title": "var(--step-2)",
        "fluid-subtitle": "var(--step-1)",
        caption: "var(--step--1)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
    },
  },
  plugins: [],
};

export default config;
