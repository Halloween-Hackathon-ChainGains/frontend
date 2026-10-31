"use client";

import { useEffect, useRef, useState } from "react";
import { adaptTown } from "./adapt";
import { mockTown } from "./mock";
import { EMPTY_TOWN, type TownData } from "./types";

const POLL_MS = 2000;
const FAILS_BEFORE_PILL = 3;
const isDev = process.env.NODE_ENV !== "production";

export type ConnectionStatus = "loading" | "ok" | "reconnecting";

export interface LoopsState {
  data: TownData;
  status: ConnectionStatus;
  /** True when showing simulated data (forced with ?mock=1, or the dev fallback). */
  isDemo: boolean;
  /** Flips true once, after the first successful load. */
  loaded: boolean;
}

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

interface Options {
  mock?: boolean;
  /** Phone: stop polling while the tab is hidden. */
  pauseWhenHidden?: boolean;
}

/** One poller for GET /api/loops. Skips overlapping ticks, keeps the last good data, dedupes identical payloads. */
export function useLoops({ mock = false, pauseWhenHidden = false }: Options = {}): LoopsState {
  const [state, setState] = useState<LoopsState>({ data: EMPTY_TOWN, status: "loading", isDemo: mock, loaded: false });
  const hashRef = useRef(0);

  useEffect(() => {
    let inFlight = false;
    let fails = 0;
    let fallback = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ctrl = new AbortController();

    const publish = (data: TownData, demo: boolean) => {
      const h = fnv(JSON.stringify(data));
      setState((prev) => {
        const status: ConnectionStatus = "ok";
        if (h === hashRef.current && prev.status === status && prev.isDemo === demo && prev.loaded) return prev;
        hashRef.current = h;
        return { data, status, isDemo: demo, loaded: true };
      });
    };

    const tick = async () => {
      if (inFlight) return;
      if (mock || fallback) {
        const sim = mockTown();
        sim.start();
        publish(sim.snapshot(), true);
        return;
      }
      inFlight = true;
      try {
        const res = await fetch("/api/loops", { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) {
          // In development an absent or broken backend falls back to the simulator, labeled "Demo data".
          if (isDev && (res.status === 404 || res.status >= 500)) {
            fallback = true;
            inFlight = false;
            return tick();
          }
          throw new Error(String(res.status));
        }
        fails = 0;
        publish(adaptTown(await res.json()), false);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (isDev && err instanceof TypeError) {
          fallback = true;
        } else if (++fails >= FAILS_BEFORE_PILL) {
          setState((prev) => (prev.status === "reconnecting" ? prev : { ...prev, status: "reconnecting" }));
        }
      } finally {
        inFlight = false;
      }
    };

    const startTimer = () => {
      if (timer) return;
      tick();
      timer = setInterval(tick, POLL_MS);
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stopTimer() : startTimer());

    if (pauseWhenHidden && document.hidden) {
      // Wait for visibility before the first request.
    } else {
      startTimer();
    }
    if (pauseWhenHidden) document.addEventListener("visibilitychange", onVisibility);

    return () => {
      ctrl.abort();
      stopTimer();
      if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mock, pauseWhenHidden]);

  return state;
}
