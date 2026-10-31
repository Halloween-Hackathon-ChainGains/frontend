"use client";

import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Bot } from "../bots/Bot";
import type { Loop, Person, TownData } from "../data/types";
import { reducedFade, spring } from "../motion/springs";
import type { Director } from "../town/director";
import { loopColorFor } from "../town/loopColors";
import styles from "./Sidebar.module.css";

interface Props {
  data: TownData;
  reduced: boolean;
  director: Director | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onHoverLoop: (id: string | null) => void;
  onOpenLoop: (id: string) => void;
}

export function Sidebar({ data, reduced, director, selectedId, onSelect, onHoverLoop, onOpenLoop }: Props) {
  const selected = selectedId ? data.people.find((p) => p.id === selectedId) : undefined;
  const byId = new Map(data.people.map((p) => [p.id, p]));
  // Number loops by discovery order; newest card first.
  const numbered = data.loops.map((l, i) => ({ loop: l, n: i + 1 }));
  const visible = director ? numbered.filter(({ loop }) => director.revealed.has(loop.id)) : numbered;
  const newestFirst = [...visible].reverse();

  return (
    <aside className={styles.sidebar} aria-label="Loop activity">
      <QrCard />
      <Stats stats={data.stats} />
      {selected ? (
        <Profile person={selected} director={director} onClose={() => onSelect(null)} />
      ) : (
        <section className={styles.deals} aria-label="Deals found">
          <h2 className={styles.h2}>Deals</h2>
          {newestFirst.length === 0 ? (
            <p className={styles.empty}>No loops yet. They appear here the moment the town finds one.</p>
          ) : (
            <ol className={styles.list}>
              <AnimatePresence initial={false}>
                {newestFirst.map(({ loop, n }) => (
                  <motion.li
                    key={loop.id}
                    layout={!reduced}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduced ? reducedFade : spring.default}
                  >
                    <DealCard loop={loop} n={n} byId={byId} onHover={onHoverLoop} onOpen={onOpenLoop} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}
        </section>
      )}
      <PeopleList people={data.people} onSelect={onSelect} />
    </aside>
  );
}

function QrCard() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/join`), []);
  const short = url.replace(/^https?:\/\//, "");
  return (
    <section className={styles.qrCard} aria-label="Join">
      <div className={styles.peek} aria-hidden>
        <Bot name="peeker" state="idle" size={64} look={{ x: 0, y: 1 }} />
      </div>
      <div className={styles.qr}>
        {url ? <QRCodeSVG value={url} size={240} level="M" marginSize={4} bgColor="#FFFFFF" fgColor="#07090F" title="QR code to join Loop" /> : <div style={{ width: 240, height: 240 }} />}
      </div>
      <div className={styles.qrText}>
        <p className={styles.scan}>Scan to trade.</p>
        <p className={styles.url}>{short}</p>
      </div>
    </section>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Stats({ stats }: { stats: TownData["stats"] }) {
  return (
    <section className={styles.stats} aria-label="Totals">
      <div className={styles.stat}>
        <NumberFlow className={styles.statValue} value={stats.valueTraded} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0, notation: stats.valueTraded >= 1e6 ? "compact" : "standard" }} />
        <span className={styles.statLabel}>traded</span>
      </div>
      <div className={styles.stat}>
        <NumberFlow className={styles.statValue} value={stats.itemsReused} format={{ notation: stats.itemsReused >= 1e5 ? "compact" : "standard" }} />
        <span className={styles.statLabel}>items reused</span>
      </div>
      <div className={styles.stat}>
        <NumberFlow className={styles.statValue} value={stats.people} format={{ notation: stats.people >= 1e5 ? "compact" : "standard" }} />
        <span className={styles.statLabel}>people</span>
      </div>
      <span className="sr-only">{`${usd.format(stats.valueTraded)} traded, ${stats.itemsReused} items reused, ${stats.people} people`}</span>
    </section>
  );
}

function DealCard({ loop, n, byId, onHover, onOpen }: { loop: Loop; n: number; byId: Map<string, Person>; onHover: (id: string | null) => void; onOpen: (id: string) => void }) {
  const color = loopColorFor(loop.id);
  const name = (id: string) => byId.get(id)?.name ?? "Someone";
  return (
    <button
      className={styles.card}
      style={{ ["--loop" as string]: color }}
      onMouseEnter={() => onHover(loop.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(loop.id)}
      onBlur={() => onHover(null)}
      onClick={() => onOpen(loop.id)}
      aria-label={`Loop ${n}, ${loop.trades.length} people. ${loop.trades.map((t) => `${name(t.from)} gives ${t.item} to ${name(t.to)}`).join(". ")}. Show in town.`}
    >
      <span className={styles.cardHead}>
        <span className={styles.cardNum}>{n}</span>
        <span className={styles.cardCaption}>{loop.message || `${loop.trades.length}-way loop`}</span>
      </span>
      <span className={styles.chain}>
        {loop.trades.map((t, i) => (
          <span key={i} className={styles.line}>
            <Bot name={name(t.from)} size={36} state="happy" tint={color} />
            <span className={styles.lineText}>
              <b>{name(t.from)}</b> → {name(t.to)}: {t.item}
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}

function Profile({ person, director, onClose }: { person: Person; director: Director | null; onClose: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => force((x) => x + 1), 500);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(iv);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const node = director?.nodes.get(person.id);
  return (
    <section className={styles.profile} aria-label={`${person.name}'s bot`}>
      <div className={styles.profileHead}>
        <Bot name={person.name} size={88} label={`${person.name}'s bot`} tint={node?.tint} state={node?.tint ? "inLoop" : "idle"} />
        <div>
          <h2 className={styles.profileName}>{person.name}</h2>
          <p className={styles.activity}>{node?.activity ?? "Wandering"}</p>
        </div>
        <button className={styles.close} onClick={onClose} aria-label="Close profile">
          <X size={22} aria-hidden />
        </button>
      </div>
      <dl className={styles.dl}>
        <dt>Has</dt>
        <dd>{person.have.join(", ") || "—"}</dd>
        <dt>Wants</dt>
        <dd>{person.want.join(", ") || "—"}</dd>
      </dl>
      {node && node.lines.length > 0 && (
        <ul className={styles.lines} aria-label="Last lines">
          {node.lines.map((l, i) => (
            <li key={i}>“{l}”</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Visually hidden list of people: the accessible version of the town. */
function PeopleList({ people, onSelect }: { people: Person[]; onSelect: (id: string) => void }) {
  return (
    <nav className="sr-only" aria-label="People in town">
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <button onClick={() => onSelect(p.id)}>{`${p.name}: has ${p.have.join(", ")}; wants ${p.want.join(", ")}`}</button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
