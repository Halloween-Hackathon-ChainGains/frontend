"use client";

import { useEffect, useRef, useState } from "react";
import { Bot } from "../bots/Bot";
import type { RenderMode } from "../bots/canvasBots";
import { mockTown } from "../data/mock";
import type { TownData } from "../data/types";
import { loopColorFor } from "../town/loopColors";
import styles from "./AdminPanel.module.css";

interface Props {
  data: TownData;
  simulated: boolean;
  mode: RenderMode;
  onMode: (m: RenderMode) => void;
  onFit: () => void;
  onShowPerson: (id: string) => void;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Organizer view: controls, totals, everyone in town and every loop. */
export function AdminPanel({ data, simulated, mode, onMode, onFit, onShowPerson }: Props) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Reset is destructive: the first press arms "Confirm reset" for 3s.
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
      if (simulated) mockTown().reset();
      else await fetch("/api/reset", { method: "POST" });
    } finally {
      setBusy(false);
    }
  };

  const loopOf = new Map<string, number>();
  data.loops.forEach((l, i) => l.trades.forEach((t) => loopOf.set(t.from, i)));
  const byId = new Map(data.people.map((p) => [p.id, p.name]));

  return (
    <div className={styles.panel}>
      <section className={styles.card} aria-labelledby="admin-controls">
        <h2 id="admin-controls" className={styles.h2}>Controls</h2>
        <div className={styles.controls}>
          <button className={styles.btn} onClick={onFit}>Fit town</button>
          <button className={styles.btn} aria-pressed={mode === "pixel"} onClick={() => onMode(mode === "pixel" ? "modern" : "pixel")}>
            Pixel art
          </button>
          <a className={styles.btn} href="/?proto=bots">Bot lab</a>
          <button className={`${styles.btn} ${armed ? styles.danger : ""}`} onClick={reset} disabled={busy}>
            {armed ? "Confirm reset" : "Reset town"}
          </button>
        </div>
        <p className={styles.note}>
          {simulated ? "The town is simulated until the backend's /api/loops responds." : "Connected to the live backend."}
        </p>
      </section>

      <section className={styles.totals} aria-label="Totals">
        <div><b>{usd.format(data.stats.valueTraded)}</b><span>traded</span></div>
        <div><b>{data.stats.itemsReused.toLocaleString()}</b><span>items reused</span></div>
        <div><b>{data.stats.people.toLocaleString()}</b><span>people</span></div>
        <div><b>{data.loops.length.toLocaleString()}</b><span>loops</span></div>
      </section>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="admin-people">
          <h2 id="admin-people" className={styles.h2}>People ({data.people.length})</h2>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Name</th><th scope="col">Has</th><th scope="col">Wants</th><th scope="col">Loop</th></tr>
              </thead>
              <tbody>
                {[...data.people].reverse().map((p) => {
                  const li = loopOf.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <button className={styles.person} onClick={() => onShowPerson(p.id)} aria-label={`Show ${p.name} in town`}>
                          <Bot name={p.name} size={28} />
                          <span>{p.name}</span>
                        </button>
                      </td>
                      <td>{p.have.join(", ")}</td>
                      <td>{p.want.join(", ")}</td>
                      <td>
                        {li === undefined ? <span className={styles.muted}>—</span> : (
                          <span className={styles.badge} style={{ background: loopColorFor(data.loops[li].id) }}>{li + 1}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="admin-loops">
          <h2 id="admin-loops" className={styles.h2}>Loops ({data.loops.length})</h2>
          <ol className={`${styles.scroll} ${styles.loops}`}>
            {[...data.loops].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
              <li key={l.id} className={styles.loop} style={{ ["--loop" as string]: loopColorFor(l.id) }}>
                <span className={styles.badge} style={{ background: "var(--loop)" }}>{i + 1}</span>
                <div>
                  <p className={styles.chain}>
                    {l.trades.map((t) => byId.get(t.from) ?? "?").join(" → ")} → {byId.get(l.trades[0]?.from) ?? "?"}
                  </p>
                  <p className={styles.muted}>{l.trades.map((t) => t.item).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
