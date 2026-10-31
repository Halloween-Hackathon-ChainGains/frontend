"use client";

import { useEffect, useRef, useState } from "react";
import type { RenderMode } from "../bots/canvasBots";
import { mockTown } from "../data/mock";
import styles from "./AdminBar.module.css";

interface Props {
  mock: boolean;
  onMock: (v: boolean) => void;
  onFit: () => void;
  mode: RenderMode;
  onMode: (m: RenderMode) => void;
}

/** ?admin=1 only. Reset is destructive: the first press arms "Confirm reset" for 3s. */
export function AdminBar({ mock, onMock, onFit, mode, onMode }: Props) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const reset = async () => {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
    setBusy(true);
    try {
      if (mock) mockTown().reset();
      else await fetch("/api/reset", { method: "POST" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.bar} role="toolbar" aria-label="Admin">
      <button className={`${styles.btn} ${armed ? styles.danger : ""}`} onClick={reset} disabled={busy}>
        {armed ? "Confirm reset" : "Reset"}
      </button>
      <button className={styles.btn} onClick={onFit}>
        Fit town
      </button>
      <button className={styles.btn} aria-pressed={mock} onClick={() => onMock(!mock)}>
        Mock data
      </button>
      <button className={styles.btn} aria-pressed={mode === "pixel"} onClick={() => onMode(mode === "pixel" ? "modern" : "pixel")}>
        Pixel
      </button>
      <a className={styles.btn} href="/?admin=1&proto=bots">
        Bot lab
      </a>
    </div>
  );
}
