"use client";

import dynamic from "next/dynamic";
import { animate, motionValue, type AnimationPlaybackControls } from "motion";
import { forceCollide } from "d3-force";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Loop, TownData } from "../data/types";
import { configureSprites, getSprite, warmSprites, type RenderMode } from "../bots/canvasBots";
import type { BotState, BotStyle } from "../bots/botSvg";
import { Director, type SimLink, type SimNode } from "./director";
import type { FG } from "./ForceGraphClient";
import { loopColorFor } from "./loopColors";
import { wrap } from "./lines";
import { renderTown } from "./townRender";
import { clampToWorld, DEAL_CIRCLES, WORLD } from "./townMap";
import styles from "./Town.module.css";

const ForceGraphClient = dynamic(() => import("./ForceGraphClient"), { ssr: false });

const BOT_W = 46;
const BOT_H = (BOT_W * 112) / 100;
const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`;
const EDGE = "rgba(110,124,156,0.55)";

export interface TownHandle {
  fitTown: () => void;
  flyToLoop: (loopId: string) => void;
  flyToPerson: (id: string) => void;
}

interface TownProps {
  data: TownData;
  /** False until the first successful poll; the director waits for real data before seeding. */
  loaded: boolean;
  reduced: boolean;
  mode?: RenderMode;
  botStyle?: BotStyle;
  highlightLoopId?: string | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onLoopStart?: (loop: Loop, color: string, memberIds: string[]) => void;
  /** The director, exposed so the sidebar can show a bot's activity and lines. */
  onDirector?: (d: Director) => void;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const Town = forwardRef<TownHandle, TownProps>(function Town(
  { data, loaded, reduced, mode = "modern", botStyle = "pearl", highlightLoopId, selectedId, onSelect, onLoopStart, onDirector },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<FG | undefined>(undefined);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fgReady, setFgReady] = useState(false);
  const [graph, setGraph] = useState<{ nodes: SimNode[]; links: SimLink[] }>({ nodes: [], links: [] });
  const townCanvas = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ highlightLoopId, selectedId, reduced, botStyle, onLoopStart });
  propsRef.current = { highlightLoopId, selectedId, reduced, botStyle, onLoopStart };

  // ── Camera: motion values carry velocity, so a new flight retargets from wherever the camera is now.
  const cam = useMemo(() => ({ x: motionValue(0), y: motionValue(0), k: motionValue(1) }), []);
  const flights = useRef<AnimationPlaybackControls[]>([]);
  const flying = useRef(false);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserInput = useRef(0);
  const fitK = useRef(1);

  const director = useMemo(() => new Director(), []);
  useEffect(() => onDirector?.(director), [director, onDirector]);

  const stopFlights = useCallback(() => {
    flights.current.forEach((f) => f.stop());
    flights.current = [];
    flying.current = false;
  }, []);

  const cancelReturn = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = null;
  }, []);

  const flyTo = useCallback(
    (x: number, y: number, k: number, duration = 0.8) => {
      const fg = fgRef.current;
      if (!fg) return;
      if (propsRef.current.reduced) {
        fg.zoom(k);
        fg.centerAt(x, y);
        return;
      }
      // Sync from the live camera when nothing is animating (the user may have panned).
      if (!flying.current) {
        const c = fg.centerAt() as unknown as { x: number; y: number };
        cam.x.jump(c.x);
        cam.y.jump(c.y);
        cam.k.jump(fg.zoom() as unknown as number);
      }
      flights.current.forEach((f) => f.stop());
      flying.current = true;
      const opts = { type: "spring" as const, bounce: 0, duration };
      let done = 0;
      const end = () => {
        if (++done === 3) flying.current = false;
      };
      flights.current = [
        animate(cam.x, x, { ...opts, onComplete: end }),
        animate(cam.y, y, { ...opts, onComplete: end }),
        animate(cam.k, k, { ...opts, onComplete: end }),
      ];
    },
    [cam],
  );

  const fitTown = useCallback(() => {
    cancelReturn();
    flyTo(0, 0, fitK.current);
  }, [flyTo, cancelReturn]);

  const flyToNodes = useCallback(
    (ids: string[], pad = 140) => {
      const ns = ids.map((id) => director.nodes.get(id)).filter((n): n is SimNode => !!n);
      if (!ns.length || !size.w) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of ns) {
        x0 = Math.min(x0, n.tx); x1 = Math.max(x1, n.tx);
        y0 = Math.min(y0, n.ty); y1 = Math.max(y1, n.ty);
      }
      const k = Math.min(3, (size.w - pad * 2) / Math.max(120, x1 - x0), (size.h - pad * 2) / Math.max(120, y1 - y0));
      flyTo((x0 + x1) / 2, (y0 + y1) / 2 - 20, Math.max(fitK.current, k));
    },
    [director, flyTo, size],
  );

  // Apply camera motion values to the graph once per frame.
  useEffect(() => {
    let raf = 0;
    let dirty = false;
    const apply = () => {
      raf = 0;
      if (!dirty) return;
      dirty = false;
      const fg = fgRef.current;
      if (!fg) return;
      fg.zoom(cam.k.get());
      fg.centerAt(cam.x.get(), cam.y.get());
    };
    const mark = () => {
      dirty = true;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const unsubs = [cam.x.on("change", mark), cam.y.on("change", mark), cam.k.on("change", mark)];
    return () => {
      unsubs.forEach((u) => u());
      cancelAnimationFrame(raf);
    };
  }, [cam]);

  useImperativeHandle(
    ref,
    () => ({
      fitTown,
      flyToLoop: (loopId: string) => {
        cancelReturn();
        const c = director.circles.get(loopId);
        if (c === undefined) return;
        const d = DEAL_CIRCLES[c];
        flyTo(d.x, d.y, Math.max(fitK.current, 2.2));
        returnTimer.current = setTimeout(fitTown, 7000);
      },
      flyToPerson: (id: string) => {
        cancelReturn();
        const n = director.nodes.get(id);
        if (!n) return;
        flyTo(n.x, n.y - 20, Math.max(fitK.current, 2.4));
        returnTimer.current = setTimeout(fitTown, 8000);
      },
    }),
    [fitTown, flyTo, cancelReturn, director],
  );

  // Director events: banner, ring camera, return.
  useEffect(() => {
    director.setEvents({
      onLoopStart: (loop, color, ids) => propsRef.current.onLoopStart?.(loop, color, ids),
      onRingFormed: (loop, ids) => {
        if (propsRef.current.reduced) return;
        cancelReturn();
        flyToNodes(ids, 180);
        // Hold through the conversation, then return, unless someone touches the town.
        returnTimer.current = setTimeout(fitTown, loop.trades.length * 1250 + 3400);
      },
    });
  }, [director, flyToNodes, fitTown, cancelReturn]);

  useEffect(() => director.setReduced(reduced), [director, reduced]);

  // Size to container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit-to-town zoom; the default camera shows the whole town.
  useEffect(() => {
    if (!size.w) return;
    fitK.current = Math.min(size.w / WORLD.w, size.h / WORLD.h) * 0.98;
    const fg = fgRef.current;
    if (fg) {
      fg.zoom(fitK.current);
      fg.centerAt(0, 0);
    }
  }, [size, fgReady]);

  // Static town, pre-rendered once per DPR / mode.
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    townCanvas.current = renderTown(Math.min(2.2, dpr * 1.4), mode);
    configureSprites({ dpr, mode });
  }, [mode]);

  // Data → director → graph (new graphData object only on topology change).
  useEffect(() => {
    if (!loaded) return;
    const changed = director.update(data);
    for (const n of director.nodes.values()) warmSprites(n.genome, BOT_W, botStyle);
    if (changed) setGraph({ nodes: [...director.nodes.values()], links: [...director.links.values()] });
  }, [data, loaded, director, botStyle]);

  // Forces: no charge, no centering, link strength 0, collision + steering + soft bounds.
  const forcesReady = useRef(false);
  const setupForces = useCallback(() => {
    const fg = fgRef.current;
    if (!fg || forcesReady.current) return;
    forcesReady.current = true;
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    const link = fg.d3Force("link") as unknown as { strength: (s: number) => void } | undefined;
    link?.strength(0);
    fg.d3Force("collide", forceCollide<SimNode>(BOT_W * 0.52).iterations(2) as never);
    const steer = Object.assign(
      () => {
        for (const n of director.nodes.values()) {
          if (n.fx !== undefined || n.mode === "thrown") continue;
          const dx = n.tx - n.x;
          const dy = n.ty - n.y;
          const d = Math.hypot(dx, dy);
          // Arrival slowdown inside 70 world px; capped speed. Gain matches velocityDecay 0.2.
          const want = d < 1.5 ? 0 : n.maxSpeed * 2.4 * Math.min(1, d / 70);
          const dvx = d ? (dx / d) * want : 0;
          const dvy = d ? (dy / d) * want : 0;
          n.vx += (dvx - n.vx) * 0.2;
          n.vy += (dvy - n.vy) * 0.2;
        }
      },
      { initialize: () => {} },
    );
    const bounds = Object.assign(
      () => {
        for (const n of director.nodes.values()) {
          const c = clampToWorld(n.x, n.y, 20);
          if (c.x !== n.x) n.vx += (c.x - n.x) * 0.2;
          if (c.y !== n.y) n.vy += (c.y - n.y) * 0.2;
        }
      },
      { initialize: () => {} },
    );
    fg.d3Force("steer", steer as never);
    fg.d3Force("bounds", bounds as never);
  }, [director]);

  useEffect(() => {
    const id = setInterval(() => {
      if (fgRef.current) {
        setupForces();
        setFgReady(true);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, [setupForces]);

  // User input on the town cancels any pending camera return and the flight in progress.
  const onUserInput = useCallback(() => {
    lastUserInput.current = performance.now();
    cancelReturn();
    stopFlights();
  }, [cancelReturn, stopFlights]);

  // ── Drawing ──

  const drawPre = useCallback((ctx: CanvasRenderingContext2D) => {
    director.tick();
    const img = townCanvas.current;
    if (img) ctx.drawImage(img, WORLD.minX, WORLD.minY, WORLD.w, WORLD.h);
  }, [director]);

  const drawNode = useCallback((node: SimNode, ctx: CanvasRenderingContext2D, gs: number) => {
    const { highlightLoopId: hl, selectedId: sel, botStyle: style, reduced: rm } = propsRef.current;
    const t = performance.now();
    const speed = Math.hypot(node.vx, node.vy);
    const moving = speed > 0.25 && !rm;
    const revealed = node.loopId ? director.revealed.has(node.loopId) : false;
    const tint = revealed ? node.tint : undefined;

    let state: BotState = "idle";
    let frame: 0 | 1 = 0;
    if (t < node.happyUntil) state = "happy";
    else if (t < node.talkUntil) {
      state = "talk";
      frame = Math.floor(t / 170) % 2 ? 1 : 0;
    } else if (t < node.waveUntil && !moving) {
      state = "wave";
      frame = Math.floor(t / 260) % 2 ? 1 : 0;
    } else if (moving) {
      state = "walk";
      frame = Math.floor(node.dist / 16) % 2 ? 1 : 0;
    } else if (t < node.blinkUntil) state = "blink";

    // Walking bob tied to distance walked; it fades to zero as the bot stops.
    const amp = moving ? Math.min(1, speed / 0.8) : 0;
    const w = node.genome.walk;
    let bob = 0;
    if (w === "hop") bob = -Math.abs(Math.sin(node.dist / 22)) * 6 * amp;
    else if (w === "waddle") bob = -Math.abs(Math.sin(node.dist / 14)) * 2.5 * amp;
    else bob = -Math.sin(node.dist / 20) * 1.2 * amp;
    // Hop wave on "Loop found".
    const hp = (t - node.hopAt) / 420;
    if (node.hopAt && hp > 0 && hp < 1) bob -= Math.sin(Math.PI * hp) * 16;

    const dim = hl && node.loopId !== hl ? 0.32 : 1;
    ctx.globalAlpha = node.fade * dim;

    // Loop glow ring at the feet.
    if (tint) {
      ctx.beginPath();
      ctx.ellipse(node.x, node.y + BOT_H * 0.42, BOT_W * 0.55, BOT_W * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = tint + "33";
      ctx.fill();
      ctx.lineWidth = Math.max(2, 3 / gs);
      ctx.strokeStyle = tint;
      ctx.stroke();
    }
    if (sel === node.id) {
      ctx.beginPath();
      ctx.ellipse(node.x, node.y + BOT_H * 0.42, BOT_W * 0.66, BOT_W * 0.26, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, 2.5 / gs);
      ctx.strokeStyle = "#F5F7FB";
      ctx.stroke();
    }

    const sprite = getSprite({ g: node.genome, state, frame, tint, style }, BOT_W);
    const x = node.x - BOT_W / 2;
    const y = node.y - BOT_H / 2 + bob;
    if (sprite) {
      if (node.facing === -1) {
        ctx.save();
        ctx.translate(node.x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -BOT_W / 2, y, BOT_W, BOT_H);
        ctx.restore();
      } else ctx.drawImage(sprite, x, y, BOT_W, BOT_H);
    } else {
      ctx.fillStyle = "#E9ECF5";
      ctx.beginPath();
      ctx.arc(node.x, node.y - 4 + bob, BOT_W * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name label pill, 16 screen px at any zoom.
    if (!node.mascot) {
      const fs = 16 / gs;
      ctx.font = `600 ${fs}px ${FONT}`;
      const label = node.name.length > 18 ? node.name.slice(0, 17).trimEnd() + "…" : node.name;
      const tw = ctx.measureText(label).width;
      const px = 7 / gs;
      const ly = node.y + BOT_H / 2 + 2 / gs;
      ctx.fillStyle = "rgba(7,9,15,0.78)";
      ctx.beginPath();
      ctx.roundRect(node.x - tw / 2 - px, ly, tw + px * 2, fs + 6 / gs, (fs + 6 / gs) / 2);
      ctx.fill();
      ctx.fillStyle = "#F5F7FB";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(label, node.x, ly + 3 / gs);
    }
    ctx.globalAlpha = 1;
  }, [director]);

  const drawPointer = useCallback((node: SimNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.fillRect(node.x - BOT_W / 2, node.y - BOT_H / 2, BOT_W, BOT_H + 10);
  }, []);

  const drawPost = useCallback((ctx: CanvasRenderingContext2D, gs: number) => {
    const bubbles = director.bubbles;
    if (!bubbles.length) return;
    const m = ctx.getTransform();
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fs = Math.max(20, Math.min(26, (wrapRef.current?.clientWidth ?? 1300) / 62));
    const lh = fs * 1.22;
    ctx.font = `600 ${fs}px ${FONT}`;
    const maxW = 260;
    const padX = 14;
    const padY = 9;
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const items = bubbles
      .map((b) => {
        const n = director.nodes.get(b.nodeId);
        if (!n) return null;
        const p = m.transformPoint(new DOMPoint(n.x, n.y - BOT_H / 2 - 4));
        return { b, n, sx: p.x / dpr, sy: p.y / dpr };
      })
      .filter((v): v is NonNullable<typeof v> => !!v && v.sx > -40 && v.sx < (wrapRef.current?.clientWidth ?? 9999) + 40 && v.sy > 0)
      .sort((a, b) => b.sy - a.sy);
    const { highlightLoopId: hl } = propsRef.current;

    for (const it of items) {
      const lines = wrap(ctx, it.b.text, maxW - padX * 2, 2);
      const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2);
      const h = lines.length * lh + padY * 2;
      let x0 = it.sx - w / 2;
      let y1 = it.sy - 10;
      // Stack upward when bubbles would collide.
      for (let guard = 0; guard < 12; guard++) {
        const hit = placed.find((r) => x0 < r.x1 + 4 && x0 + w > r.x0 - 4 && y1 > r.y0 - 4 && y1 - h < r.y1 + 4);
        if (!hit) break;
        y1 = hit.y0 - 6;
      }
      x0 = Math.max(6, Math.min((wrapRef.current?.clientWidth ?? 9999) - w - 6, x0));
      const y0 = y1 - h;
      placed.push({ x0, y0, x1: x0 + w, y1 });

      const dim = hl && it.n.loopId !== hl ? 0.35 : 1;
      ctx.globalAlpha = it.b.o * dim * it.n.fade;
      const s = it.b.s;
      const ox = it.sx;
      const oy = it.sy - 4;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(s, s);
      ctx.translate(-ox, -oy);
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#F4F1EA";
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, h, Math.min(18, h / 2));
      // Tail toward the speaker.
      const tx = Math.max(x0 + 16, Math.min(x0 + w - 16, it.sx));
      ctx.moveTo(tx - 8, y1 - 1);
      ctx.lineTo(it.sx, Math.min(it.sy - 2, y1 + 9));
      ctx.lineTo(tx + 8, y1 - 1);
      ctx.fill();
      ctx.shadowColor = "transparent";
      if (it.n.tint && it.n.loopId && director.revealed.has(it.n.loopId)) {
        ctx.fillStyle = it.n.tint;
        ctx.beginPath();
        ctx.roundRect(x0 + 6, y0 + 8, 4, h - 16, 2);
        ctx.fill();
      }
      ctx.fillStyle = "#14161C";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      lines.forEach((l, i) => ctx.fillText(l, x0 + padX, y0 + padY + i * lh + 1));
      ctx.restore();
    }
    ctx.restore();
    void gs;
  }, [director]);

  // Link styling.
  const linkColor = useCallback((l: SimLink) => {
    if (l.loopId && director.revealed.has(l.loopId)) {
      const c = loopColorFor(l.loopId);
      const hl = propsRef.current.highlightLoopId;
      return hl && hl !== l.loopId ? c + "40" : c;
    }
    return propsRef.current.highlightLoopId ? "rgba(110,124,156,0.18)" : EDGE;
  }, [director]);
  const isLoop = useCallback((l: SimLink) => !!l.loopId && director.revealed.has(l.loopId), [director]);

  const linkLabel = useCallback((l: SimLink) => {
    const { s, t } = director.linkIds(l);
    const a = director.nodes.get(s)?.name ?? "?";
    const b = director.nodes.get(t)?.name ?? "?";
    return `<div class="${styles.tip}"><b>${escapeHtml(l.item)}</b><span>${escapeHtml(a)} → ${escapeHtml(b)}</span></div>`;
  }, [director]);

  // Throw a bot: track velocity during drag, hand it to the simulation on release.
  const dragSamples = useRef<{ x: number; y: number; t: number }[]>([]);
  const onNodeDrag = useCallback((n: SimNode) => {
    onUserInput();
    const s = dragSamples.current;
    s.push({ x: n.fx ?? n.x, y: n.fy ?? n.y, t: performance.now() });
    while (s.length > 2 && s[s.length - 1].t - s[0].t > 90) s.shift();
  }, [onUserInput]);
  const onNodeDragEnd = useCallback((n: SimNode) => {
    const s = dragSamples.current;
    dragSamples.current = [];
    let vx = 0, vy = 0;
    if (s.length >= 2) {
      const a = s[0], b = s[s.length - 1];
      const dt = Math.max(8, b.t - a.t);
      // world px per ms → per simulation tick (~16.7ms)
      vx = ((b.x - a.x) / dt) * 16.7;
      vy = ((b.y - a.y) / dt) * 16.7;
      const max = 40;
      const mag = Math.hypot(vx, vy);
      if (mag > max) { vx = (vx / mag) * max; vy = (vy / mag) * max; }
    }
    director.throwNode(n, vx, vy);
  }, [director]);

  // Spring back inside the town if the user pans past its bounds.
  const onZoomEnd = useCallback((tr: { k: number; x: number; y: number }) => {
    if (flying.current || performance.now() - lastUserInput.current > 600 || !size.w) return;
    const cx = (size.w / 2 - tr.x) / tr.k;
    const cy = (size.h / 2 - tr.y) / tr.k;
    const halfW = size.w / 2 / tr.k;
    const halfH = size.h / 2 / tr.k;
    const limX = Math.max(0, WORLD.w / 2 - halfW);
    const limY = Math.max(0, WORLD.h / 2 - halfH);
    const nx = Math.max(-limX, Math.min(limX, cx));
    const ny = Math.max(-limY, Math.min(limY, cy));
    if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) {
      flying.current = false;
      flyTo(nx, ny, tr.k, 0.4);
    }
  }, [flyTo, size]);

  const people = data.people.length;
  const loops = data.loops.length;

  return (
    <div
      ref={wrapRef}
      className={styles.town}
      role="img"
      aria-label={`Bot Town: ${people} ${people === 1 ? "person" : "people"}, ${loops} ${loops === 1 ? "loop" : "loops"}`}
      onPointerDown={onUserInput}
      onWheel={onUserInput}
    >
      {size.w > 0 && (
        <ForceGraphClient
          graphRef={fgRef}
          width={size.w}
          height={size.h}
          graphData={graph}
          backgroundColor="#101A33"
          nodeId="id"
          nodeLabel={() => ""}
          nodeCanvasObject={drawNode}
          nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={drawPointer}
          onNodeClick={(n) => onSelect?.(n.mascot ? null : n.id)}
          onBackgroundClick={() => onSelect?.(null)}
          onNodeDrag={onNodeDrag}
          onNodeDragEnd={onNodeDragEnd}
          onRenderFramePre={drawPre}
          onRenderFramePost={drawPost}
          onZoomEnd={onZoomEnd}
          linkColor={linkColor}
          linkWidth={(l) => (isLoop(l) ? 4 : 1.25)}
          linkCurvature={(l) => (isLoop(l) ? 0.16 : 0)}
          linkLabel={linkLabel}
          linkDirectionalParticles={(l) => (isLoop(l) && !reduced ? 3 : 0)}
          linkDirectionalParticleWidth={5}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleColor={(l) => (l.loopId ? loopColorFor(l.loopId) : EDGE)}
          linkDirectionalArrowLength={(l) => (isLoop(l) && reduced ? 10 : 0)}
          linkDirectionalArrowRelPos={0.6}
          linkDirectionalArrowColor={(l) => (l.loopId ? loopColorFor(l.loopId) : EDGE)}
          d3AlphaDecay={0}
          d3VelocityDecay={0.2}
          warmupTicks={0}
          cooldownTicks={Infinity}
          cooldownTime={Infinity}
          autoPauseRedraw={false}
          enableNodeDrag
          minZoom={fitK.current * 0.85}
          maxZoom={5}
        />
      )}
    </div>
  );
});
