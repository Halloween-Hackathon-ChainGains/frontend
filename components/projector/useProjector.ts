"use client";

import { useEffect } from "react";

/** Keep the projector laptop awake; re-acquire after the tab becomes visible again. */
export function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let lock: Sentinel | null = null;
    const acquire = async () => {
      try {
        lock = await nav.wakeLock!.request("screen");
      } catch {
        /* denied or unsupported; nothing to do */
      }
    };
    const onVis = () => document.visibilityState === "visible" && acquire();
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** Hide the cursor after 3s without pointer movement. */
export function useIdleCursor(ms = 3000) {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const root = document.documentElement;
    const wake = () => {
      root.classList.remove("hide-cursor");
      clearTimeout(t);
      t = setTimeout(() => root.classList.add("hide-cursor"), ms);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(t);
      root.classList.remove("hide-cursor");
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [ms]);
}
