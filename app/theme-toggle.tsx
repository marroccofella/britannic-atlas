"use client";

import { useEffect, useRef } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("britannic-theme") as Theme | null;
    const next = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = next;
    button.current?.setAttribute("aria-pressed", String(next === "dark"));
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("britannic-theme", next);
    button.current?.setAttribute("aria-pressed", String(next === "dark"));
  };

  return <button ref={button} className="theme-toggle" onClick={toggle} aria-label="Toggle light and dark mode" aria-pressed="false">
    <span className="theme-when-light" aria-hidden="true">◐</span><span className="theme-when-dark" aria-hidden="true">☼</span><b><span className="theme-when-light">DARK</span><span className="theme-when-dark">LIGHT</span></b>
  </button>;
}
