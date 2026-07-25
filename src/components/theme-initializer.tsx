"use client";

import { useEffect } from "react";

export function ThemeInitializer() {
  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem("theme");
    const theme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    // Apply theme without triggering hydration mismatch
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  return null;
}
