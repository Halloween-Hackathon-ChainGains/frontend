"use client";

import { useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot } from "./bots/Mascot";
import type { BotStyle } from "./bots/botSvg";
import type { RenderMode } from "./bots/canvasBots";
import { useLoops } from "./data/useLoops";
import type { Loop } from "./data/types";
import { AdminBar } from "./admin/AdminBar";
import { BotProto } from "./proto/BotProto";
import { useIdleCursor, useWakeLock } from "./projector/useProjector";
import { Sidebar } from "./sidebar/Sidebar";
import type { Director } from "./town/director";
import { LoopBanner, type BannerInfo } from "./town/LoopBanner";
import { Town, type TownHandle } from "./town/Town";
import styles from "./Home.module.css";

export function Home() {
  const params = useSearchParams();
  const admin = params.get("admin") === "1";
  const proto = admin ? params.get("proto") : null;
  const [mockToggle, setMockToggle] = useState(params.get("mock") === "1");
  const [mode, setMode] = useState<RenderMode>((params.get("art") as RenderMode) === "pixel" ? "pixel" : "modern");
  const [botStyle, setBotStyle] = useState<BotStyle>("pearl");
  const reduced = !!useReducedMotion();

  const { data, status, isDemo, loaded } = useLoops({ mock: mockToggle });
  const townRef = useRef<TownHandle>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverLoop, setHoverLoop] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [, bump] = useState(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopsRef = useRef(data.loops);
  loopsRef.current = data.loops;

  useWakeLock();
  useIdleCursor();

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

  if (proto === "bots") {
    return <BotProto style={botStyle} onStyle={setBotStyle} mode={mode} onMode={setMode} />;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Mascot size={52} />
          <span className={styles.wordmark}>Loop</span>
        </div>
        <p className={styles.tagline}>Kidney exchange for everything else.</p>
        <div className={styles.pills}>
          {isDemo && <span className={styles.pill}>Demo data</span>}
          {status === "reconnecting" && (
            <span className={styles.pill} role="status">
              Reconnecting…
            </span>
          )}
          {admin && (
            <AdminBar
              mock={mockToggle}
              onMock={setMockToggle}
              onFit={() => townRef.current?.fitTown()}
              mode={mode}
              onMode={setMode}
            />
          )}
        </div>
      </header>
      <main className={styles.main}>
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
          <LoopBanner banner={banner} reduced={reduced} />
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
    </div>
  );
}
