"use client";

import { useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AdminPanel } from "./admin/AdminPanel";
import { Mascot } from "./bots/Mascot";
import type { BotStyle } from "./bots/botSvg";
import type { RenderMode } from "./bots/canvasBots";
import { useLoops } from "./data/useLoops";
import type { Loop } from "./data/types";
import { JoinFlow } from "./join/JoinFlow";
import { BotProto } from "./proto/BotProto";
import { useIdleCursor, useWakeLock } from "./projector/useProjector";
import { Sidebar } from "./sidebar/Sidebar";
import type { Director } from "./town/director";
import { LoopBanner, type BannerInfo } from "./town/LoopBanner";
import { Town, type TownHandle } from "./town/Town";
import styles from "./Home.module.css";

export type View = "town" | "join" | "admin";
const VIEWS: { id: View; label: string }[] = [
  { id: "town", label: "Town" },
  { id: "join", label: "Join" },
  { id: "admin", label: "Admin" },
];

const isView = (v: string | null): v is View => v === "town" || v === "join" || v === "admin";

/** The whole app on one page: the town, joining with your bot, and the organizer view. */
export function Home({ initialView = "town" }: { initialView?: View }) {
  const params = useSearchParams();
  const proto = params.get("proto");
  const fromUrl = params.get("view");
  const [view, setView] = useState<View>(isView(fromUrl) ? fromUrl : initialView);
  const [mode, setMode] = useState<RenderMode>(params.get("art") === "pixel" ? "pixel" : "modern");
  const [botStyle, setBotStyle] = useState<BotStyle>("pearl");
  const reduced = !!useReducedMotion();

  const { data, status, isDemo, loaded } = useLoops({ mock: params.get("mock") === "1" });
  const townRef = useRef<TownHandle>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverLoop, setHoverLoop] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [, bump] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopsRef = useRef(data.loops);
  useEffect(() => {
    loopsRef.current = data.loops;
  }, [data.loops]);

  useWakeLock();
  useIdleCursor();

  // Keep the URL in step with the tab, without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.pathname === "/join" && view === "join") return;
    url.pathname = "/";
    if (view === "town") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
  }, [view]);

  const onLoopStart = useCallback((loop: Loop, color: string) => {
    const number = loopsRef.current.findIndex((l) => l.id === loop.id) + 1;
    setBanner({ key: loop.id, size: loop.trades.length, color, number });
    bump((x) => x + 1);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const showPerson = useCallback((id: string) => {
    setView("town");
    setSelectedId(id);
    // Let the town become visible before flying the camera.
    requestAnimationFrame(() => townRef.current?.flyToPerson(id));
  }, []);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = VIEWS.findIndex((v) => v.id === view);
    const next = VIEWS[(i + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length].id;
    setView(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  if (proto === "bots") {
    return <BotProto style={botStyle} onStyle={setBotStyle} mode={mode} onMode={setMode} />;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Mascot size={44} />
          <span className={styles.wordmark}>Loop</span>
        </div>
        <p className={styles.tagline}>Kidney exchange for everything else.</p>
        <div className={styles.right}>
          {status === "reconnecting" && (
            <span className={styles.pill} role="status">
              Reconnecting…
            </span>
          )}
          <div className={styles.tabs} role="tablist" aria-label="Views" onKeyDown={onTabKey}>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                id={`tab-${v.id}`}
                role="tab"
                aria-selected={view === v.id}
                aria-controls={`panel-${v.id}`}
                tabIndex={view === v.id ? 0 : -1}
                className={styles.tab}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.views}>
        {/* The town stays mounted (and keeps simulating) behind the other tabs. */}
        <main
          id="panel-town"
          role="tabpanel"
          aria-labelledby="tab-town"
          className={styles.main}
          data-active={view === "town"}
          inert={view !== "town"}
        >
          <div className={styles.townWrap}>
            <Town
              ref={townRef}
              data={data}
              loaded={loaded}
              reduced={reduced}
              mode={mode}
              botStyle={botStyle}
              highlightLoopId={hoverLoop}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onLoopStart={onLoopStart}
              onDirector={setDirector}
            />
            <LoopBanner banner={view === "town" ? banner : null} reduced={reduced} />
          </div>
          <Sidebar
            data={data}
            reduced={reduced}
            director={director}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onHoverLoop={setHoverLoop}
            onOpenLoop={(id) => townRef.current?.flyToLoop(id)}
          />
        </main>

        <section id="panel-join" role="tabpanel" aria-labelledby="tab-join" className={styles.overlay} hidden={view !== "join"}>
          <JoinFlow embedded onSeeInTown={showPerson} />
        </section>

        <section id="panel-admin" role="tabpanel" aria-labelledby="tab-admin" className={styles.overlay} hidden={view !== "admin"}>
          <AdminPanel
            data={data}
            simulated={isDemo}
            mode={mode}
            onMode={setMode}
            onFit={() => {
              setView("town");
              requestAnimationFrame(() => townRef.current?.fitTown());
            }}
            onShowPerson={showPerson}
          />
        </section>
      </div>
    </div>
  );
}
