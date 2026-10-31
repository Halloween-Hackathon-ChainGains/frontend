"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Bot } from "../bots/Bot";
import { rubberClamp, spring, VelocityTracker } from "../motion/springs";
import styles from "./Join.module.css";

/** The user's bot standing at a small strip of the town gate. Drag and fling it; it springs home. */
export function GateStrip({ name, happy, bubble, reduced }: { name: string; happy: boolean; bubble: string; reduced: boolean }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const grab = useRef<{ ox: number; oy: number; id: number } | null>(null);
  const vt = useRef(new VelocityTracker());
  const botRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    x.stop();
    y.stop();
    // Respect the grab offset: track from where the finger landed relative to the current position.
    grab.current = { ox: e.clientX - x.get(), oy: e.clientY - y.get(), id: e.pointerId };
    vt.current.reset();
    vt.current.push(e.clientX, e.clientY);
    setDragging(true);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const r = botRef.current?.getBoundingClientRect();
    if (r) {
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const m = Math.max(40, Math.hypot(dx, dy));
      setLook({ x: dx / m, y: dy / m });
    }
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    // 1:1, rubber-banding past ~80px.
    x.set(rubberClamp(e.clientX - g.ox, 80, 260));
    y.set(rubberClamp(e.clientY - g.oy, 80, 260));
    vt.current.push(e.clientX, e.clientY);
  };
  const onUp = () => {
    if (!grab.current) return;
    grab.current = null;
    setDragging(false);
    setLook({ x: 0, y: 0 });
    const { vx, vy } = vt.current.get();
    if (reduced) {
      animate(x, 0, { duration: 0.2 });
      animate(y, 0, { duration: 0.2 });
      return;
    }
    // Home, with the release velocity handed off; bounce earned by the fling.
    animate(x, 0, { ...spring.momentum, velocity: vx });
    animate(y, 0, { ...spring.momentum, velocity: vy });
  };

  return (
    <div className={styles.gate} aria-label={`${name}'s bot at the town gate`} role="img">
      <svg className={styles.gateArt} viewBox="0 0 360 160" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#FFC478" stopOpacity=".35" />
            <stop offset="1" stopColor="#FFC478" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="160" fill="#101A33" />
        <rect y="112" width="360" height="48" fill="#18233F" />
        <circle cx="290" cy="80" r="70" fill="url(#lamp)" />
        <rect x="286" y="60" width="6" height="60" rx="3" fill="#2A3558" />
        <circle cx="289" cy="58" r="6" fill="#FFE2B0" />
        <rect x="40" y="56" width="16" height="64" rx="4" fill="#2B3862" />
        <rect x="120" y="56" width="16" height="64" rx="4" fill="#2B3862" />
        <path d="M44 60 Q88 20 132 60" stroke="#3A4A7C" strokeWidth="8" fill="none" strokeLinecap="round" />
      </svg>
      <p className={styles.gateBubble} aria-live="polite">{bubble}</p>
      <motion.div
        ref={botRef}
        layoutId={reduced ? undefined : "me-bot"}
        className={styles.gateBot}
        style={{ x, y, cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        transition={spring.default}
      >
        <Bot name={name} size={104} state={happy ? "happy" : dragging ? "looking" : "idle"} look={look} />
      </motion.div>
    </div>
  );
}
