"use client";

import { Bot } from "../bots/Bot";
import type { BotStyle } from "../bots/botSvg";
import type { RenderMode } from "../bots/canvasBots";
import { FIRST_NAMES } from "../data/fixtures";
import styles from "./BotProto.module.css";

const STYLES: { id: BotStyle; label: string; note: string }[] = [
  { id: "pearl", label: "Pearl", note: "Glossy pearl-white shells, pastel accents. Picked: pops hardest on the navy town." },
  { id: "pastel", label: "Pastel shell", note: "Accent-tinted shells. Friendlier, but loop glow competes with the shell color." },
  { id: "outline", label: "Outline", note: "Flat with ink outlines. Crisp at small sizes, loses the 3D read." },
];

const STATES = ["idle", "walk", "talk", "happy", "wave"] as const;

/** /?admin=1&proto=bots — bot direction explorer. The switcher stays for the team. */
export function BotProto({ style, onStyle, mode, onMode }: { style: BotStyle; onStyle: (s: BotStyle) => void; mode: RenderMode; onMode: (m: RenderMode) => void }) {
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1>Bot lab</h1>
        <a href="/?admin=1" className={styles.back}>Back to town</a>
      </header>
      <div className={styles.switcher} role="radiogroup" aria-label="Bot direction">
        {STYLES.map((s) => (
          <button key={s.id} role="radio" aria-checked={style === s.id} onClick={() => onStyle(s.id)} className={styles.opt}>
            <b>{s.label}</b>
            <span>{s.note}</span>
          </button>
        ))}
      </div>
      <div className={styles.switcher} role="radiogroup" aria-label="Town style">
        {(["modern", "pixel"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => onMode(m)} className={styles.opt}>
            <b>{m === "modern" ? "Modern diorama" : "Pixel RPG"}</b>
            <span>{m === "modern" ? "Soft night campus. Default." : "16px tile grid, nearest-neighbor bots."}</span>
          </button>
        ))}
      </div>
      <h2>Archetypes and crowd</h2>
      <div className={styles.grid}>
        {FIRST_NAMES.slice(0, 32).map((n) => (
          <figure key={n} className={styles.cell}>
            <Bot name={n} size={88} style={style} label={`${n}'s bot`} />
            <figcaption>{n}</figcaption>
          </figure>
        ))}
      </div>
      <h2>States</h2>
      <div className={styles.grid}>
        {STATES.map((s) => (
          <figure key={s} className={styles.cell}>
            <Bot name="Maya" size={110} style={style} state={s} />
            <figcaption>{s}</figcaption>
          </figure>
        ))}
        <figure className={styles.cell}>
          <Bot name="Maya" size={110} style={style} state="inLoop" tint="#FF9F0A" />
          <figcaption>inLoop</figcaption>
        </figure>
        <figure className={styles.cell}>
          <Bot name="Maya" size={110} style={style} state="looking" look={{ x: 1, y: -1 }} />
          <figcaption>looking</figcaption>
        </figure>
      </div>
    </main>
  );
}
