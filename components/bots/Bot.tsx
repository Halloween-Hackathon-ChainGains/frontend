"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import { botMarkup, BOT_H, BOT_W, type BotState, type BotStyle } from "./botSvg";
import { genomeFor, type Genome } from "./genome";

export type BotMood = BotState | "looking" | "inLoop";

interface BotProps {
  /** Person's name (seed) or an explicit genome. */
  name?: string;
  genome?: Genome;
  state?: BotMood;
  look?: { x: number; y: number };
  tint?: string;
  facing?: 1 | -1;
  size?: number;
  style?: BotStyle;
  /** When set, the bot stands for this person. Otherwise it's decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
}

/** Quantize pupil offsets so pointer tracking doesn't re-render on every sub-pixel move. */
const q = (v: number) => Math.round(v * 8) / 8;

function BotImpl({ name, genome, state = "idle", look, tint, facing = 1, size = 96, style, label, className }: BotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = genome ?? genomeFor(name ?? "");
  const [blink, setBlink] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);

  const base: BotState = state === "looking" || state === "inLoop" ? "idle" : state;

  // Randomized blink every 3–6s while idle.
  useEffect(() => {
    if (base !== "idle") return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 3000 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(t);
  }, [base]);

  // Two-frame cycle only while an action is happening (talking, waving, walking).
  useEffect(() => {
    if (base !== "talk" && base !== "wave" && base !== "walk") return;
    const iv = setInterval(() => setFrame((f) => (f ? 0 : 1)), base === "talk" ? 170 : 260);
    return () => clearInterval(iv);
  }, [base]);

  const lx = q(look?.x ?? 0);
  const ly = q(look?.y ?? 0);
  const html = useMemo(
    () =>
      botMarkup(g, {
        state: blink && base === "idle" ? "blink" : base,
        frame,
        look: { x: lx * facing, y: ly },
        tint: state === "inLoop" || tint ? tint : undefined,
        style,
      }, uid),
    [g, blink, base, frame, lx, ly, facing, state, tint, style, uid],
  );

  return (
    <svg
      className={className}
      viewBox={`0 0 ${BOT_W} ${BOT_H}`}
      width={size}
      height={(size * BOT_H) / BOT_W}
      style={facing === -1 ? { transform: "scaleX(-1)" } : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const Bot = memo(BotImpl);
