"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function get(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem("vault-theme", theme);
  } catch {
    // storage indisponível: o tema só não persiste
  }
  listeners.forEach((fn) => fn());
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, get, () => "dark");
}
