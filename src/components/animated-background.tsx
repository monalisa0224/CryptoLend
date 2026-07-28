"use client";

export function AnimatedBackground({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`app-animated-background ${isDarkMode ? "is-dark" : "is-light"}`} aria-hidden="true">
      <span className="app-bg-blob app-bg-blob-1" />
      <span className="app-bg-blob app-bg-blob-2" />
      <span className="app-bg-blob app-bg-blob-3" />
      <span className="app-bg-blob app-bg-blob-4" />
      <span className="app-bg-grid" />
      <span className="app-bg-overlay" />
    </div>
  );
}
