"use client";

import { Check, CalendarPlus, Clock, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "../bots/Bot";
import type { Loop, TownData } from "../data/types";
import { reducedFade, spring } from "../motion/springs";
import { loopColorFor } from "../town/loopColors";
import { formatWhen, icsFor, loopBeats, meetupFor, scoutBeats, type Beat, type Me } from "./story";
import styles from "./BotStory.module.css";

export type Phase = "talking" | "loop" | "approve" | "confirmed" | "declined";

// ───────────────────────── player ─────────────────────────

/** Plays beats one at a time with a typing pause, so the chat reads as live. */
export function useStory(data: TownData, me: Me, loaded: boolean) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<Beat | null>(null);
  const added = useRef(new Set<string>());

  // Scouting script, once the town has other bots in it.
  useEffect(() => {
    if (!loaded || added.current.has("scout")) return;
    if (data.people.filter((p) => p.id !== me.id).length === 0) return;
    added.current.add("scout");
    setBeats((b) => [...b, ...scoutBeats(data, me)]);
  }, [data, me, loaded]);

  // Each loop that includes me, once.
  useEffect(() => {
    if (!added.current.has("scout")) return;
    for (const l of data.loops) {
      if (added.current.has(l.id) || !l.trades.some((t) => t.from === me.id || t.to === me.id)) continue;
      added.current.add(l.id);
      setBeats((b) => [...b, ...loopBeats(l, data, me)]);
    }
  }, [data, me, beats.length]);

  useEffect(() => {
    if (shown >= beats.length) return;
    const next = beats[shown];
    if (next.kind === "msg") {
      const t1 = setTimeout(() => setTyping(next), 350);
      const t2 = setTimeout(() => {
        setTyping(null);
        setShown((s) => s + 1);
      }, 350 + 700 + Math.min(900, next.text.length * 18));
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    const t = setTimeout(() => setShown((s) => s + 1), next.kind === "status" ? 700 : 500);
    return () => clearTimeout(t);
  }, [shown, beats]);

  return { beats: beats.slice(0, shown), typing, done: shown >= beats.length };
}

// ───────────────────────── stepper ─────────────────────────

const STEPS = ["Told your bot", "Bots talking", "Loop found", "Meetup"];

export function Stepper({ phase }: { phase: Phase }) {
  const at = phase === "talking" ? 1 : phase === "loop" ? 2 : 3;
  const complete = phase === "confirmed";
  return (
    <ol className={styles.stepper} aria-label="Progress">
      {STEPS.map((s, i) => {
        const state = i < at || complete ? "done" : i === at ? "now" : "next";
        return (
          <li key={s} className={styles.step} data-state={state} aria-current={state === "now" ? "step" : undefined}>
            <span className={styles.stepDot}>{state === "done" ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}</span>
            <span className={styles.stepLabel}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────── feed ─────────────────────────

interface FeedProps {
  beats: Beat[];
  typing: Beat | null;
  data: TownData;
  me: Me;
  mock: boolean;
  reduced: boolean;
  onPhase: (p: Phase) => void;
}

export function Feed({ beats, typing, data, me, mock, reduced, onPhase }: FeedProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const loops = useMemo(() => new Map(data.loops.map((l) => [l.id, l])), [data.loops]);

  // Who each scouting thread is with, for its divider.
  const threadWith = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of beats) if (b.kind === "msg" && !b.mine && !m.has(b.thread)) m.set(b.thread, b.fromName);
    return m;
  }, [beats]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" });
  }, [beats.length, typing, reduced]);

  const enter = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reducedFade }
    : { initial: { opacity: 0, transform: "translateY(8px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: spring.quick };

  let lastThread = "";
  return (
    <div className={styles.feed} role="log" aria-live="polite" aria-label="Your bot's conversations">
      {beats.map((b, i) => {
        const items: React.ReactNode[] = [];
        if (b.kind === "msg" && b.thread !== lastThread) {
          lastThread = b.thread;
          const label = b.thread.startsWith("loop:")
            ? "The loop"
            : b.thread.startsWith("hi:")
              ? `Bumped into ${threadWith.get(b.thread) ?? "a bot"}`
              : `With ${threadWith.get(b.thread) ?? "a bot"}`;
          items.push(
            <motion.p key={`d${i}`} className={styles.divider} {...enter}>
              {label}
            </motion.p>,
          );
        }
        if (b.kind === "status") {
          items.push(
            <motion.p key={i} className={styles.status} {...enter}>
              {b.text}
            </motion.p>,
          );
        } else if (b.kind === "msg") {
          items.push(<Message key={i} beat={b} enter={enter} tint={b.thread.startsWith("loop:") ? loopColorFor(b.thread.slice(5)) : undefined} />);
        } else if (b.kind === "loop") {
          const loop = loops.get(b.loopId);
          if (loop) items.push(<LoopCard key={i} loop={loop} data={data} me={me} enter={enter} />);
        } else if (b.kind === "proposal") {
          const loop = loops.get(b.loopId);
          if (loop) items.push(<Proposal key={i} loop={loop} data={data} me={me} mock={mock} enter={enter} onPhase={onPhase} />);
        }
        return items;
      })}
      {typing && typing.kind === "msg" && (
        <div className={`${styles.row} ${typing.mine ? styles.mine : ""}`} aria-hidden>
          <Bot name={typing.fromName} size={34} state="talk" />
          <div className={styles.typing}>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

type Enter = Record<string, unknown>;

function Message({ beat, enter, tint }: { beat: Extract<Beat, { kind: "msg" }>; enter: Enter; tint?: string }) {
  return (
    <motion.div className={`${styles.row} ${beat.mine ? styles.mine : ""}`} {...enter}>
      <Bot name={beat.fromName} size={34} state={tint ? "inLoop" : "idle"} tint={tint} />
      <div className={styles.msg}>
        <span className={styles.who}>{beat.mine ? "Your bot" : `${beat.fromName}'s bot`}</span>
        <p className={styles.bubble} style={tint ? { boxShadow: `inset 3px 0 0 ${tint}` } : undefined}>
          {beat.text}
        </p>
      </div>
    </motion.div>
  );
}

function names(data: TownData, me: Me) {
  const byId = new Map(data.people.map((p) => [p.id, p.name]));
  return (id: string) => (id === me.id ? "You" : byId.get(id) ?? "Someone");
}

function LoopCard({ loop, data, me, enter }: { loop: Loop; data: TownData; me: Me; enter: Enter }) {
  const color = loopColorFor(loop.id);
  const name = names(data, me);
  // Start the ring at me so it reads "You → … → You".
  const start = Math.max(0, loop.trades.findIndex((t) => t.from === me.id));
  const ring = [...loop.trades.slice(start), ...loop.trades.slice(0, start)];
  return (
    <motion.section className={styles.loopCard} style={{ ["--loop" as string]: color }} {...enter} aria-label={`Loop found with ${loop.trades.length} people`}>
      <p className={styles.loopTitle}>Loop found · {loop.trades.length} people</p>
      <ol className={styles.ring}>
        {ring.map((t, i) => (
          <li key={i} className={styles.ringStep}>
            <span className={styles.ringBot}>
              <Bot name={t.from === me.id ? me.name : name(t.from)} size={40} state="happy" tint={color} />
              <span>{name(t.from)}</span>
            </span>
            <span className={styles.ringArrow}>
              <span className={styles.ringItem}>{t.item}</span>
              <span aria-hidden>→</span>
            </span>
          </li>
        ))}
        <li className={styles.ringStep}>
          <span className={styles.ringBot}>
            <Bot name={me.name} size={40} state="happy" tint={color} />
            <span>You</span>
          </span>
        </li>
      </ol>
      {loop.message && <p className={styles.loopMsg}>{loop.message}</p>}
    </motion.section>
  );
}

// ───────────────────────── proposal ─────────────────────────

type Vote = "pending" | "yes";
const keyFor = (id: string) => `loop:meetup:${id}`;

function Proposal({ loop, data, me, mock, enter, onPhase }: { loop: Loop; data: TownData; me: Me; mock: boolean; enter: Enter; onPhase: (p: Phase) => void }) {
  const color = loopColorFor(loop.id);
  const name = names(data, me);
  const others = loop.trades.map((t) => t.from).filter((id) => id !== me.id);
  const give = loop.trades.find((t) => t.from === me.id);
  const get = loop.trades.find((t) => t.to === me.id);

  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(keyFor(loop.id)) ?? "null") as { attempt: number; mine: "pending" | "yes" | "no" } | null;
    } catch {
      return null;
    }
  }, [loop.id]);
  const [attempt, setAttempt] = useState(saved?.attempt ?? 0);
  const [mine, setMine] = useState<"pending" | "yes" | "no">(saved?.mine ?? "pending");
  const [votes, setVotes] = useState<Record<string, Vote>>(() => Object.fromEntries(others.map((o) => [o, "pending"])));
  const meet = meetupFor(loop.id, attempt);

  useEffect(() => {
    try {
      localStorage.setItem(keyFor(loop.id), JSON.stringify({ attempt, mine }));
    } catch {}
  }, [attempt, mine, loop.id]);

  // In demo mode the other bots answer for their humans after a beat.
  useEffect(() => {
    if (!mock) return;
    setVotes(Object.fromEntries(others.map((o) => [o, "pending"])));
    const timers = others.map((o, i) =>
      setTimeout(() => setVotes((v) => ({ ...v, [o]: "yes" })), 1400 + i * 1300 + Math.random() * 900),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, mock, loop.id]);

  const allYes = others.every((o) => votes[o] === "yes");
  const phase: Phase = mine === "no" ? "declined" : mine === "yes" && allYes ? "confirmed" : "approve";
  useEffect(() => onPhase(phase), [phase, onPhase]);

  const addToCalendar = () => {
    const blob = new Blob([icsFor(`Loop swap: ${give?.item ?? "trade"}`, meet.place, meet.start)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loop-meetup.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <motion.section className={styles.proposal} style={{ ["--loop" as string]: color }} {...enter} aria-labelledby={`prop-${loop.id}`}>
      <h2 id={`prop-${loop.id}`} className={styles.propTitle}>
        {phase === "confirmed" ? "Meetup confirmed" : phase === "declined" ? "Your bot will keep looking" : "Approve this meetup?"}
      </h2>
      <p className={styles.deal}>
        {give && (
          <>
            You give <b>{give.item}</b> to <b>{name(give.to)}</b>
          </>
        )}
        {give && get && ", "}
        {get && (
          <>
            you get <b>{get.item}</b> from <b>{name(get.from)}</b>
          </>
        )}
        .
      </p>
      {phase !== "declined" && (
        <dl className={styles.meet}>
          <div>
            <dt>
              <MapPin size={18} aria-hidden />
              <span className="sr-only">Where</span>
            </dt>
            <dd>{meet.place}</dd>
          </div>
          <div>
            <dt>
              <Clock size={18} aria-hidden />
              <span className="sr-only">When</span>
            </dt>
            <dd>{formatWhen(meet.start)}</dd>
          </div>
        </dl>
      )}
      {phase !== "declined" && (
        <ul className={styles.votes} aria-label="Who has approved">
          {[me.id, ...others].map((id) => {
            const yes = id === me.id ? mine === "yes" : votes[id] === "yes";
            return (
              <li key={id} className={styles.vote} data-yes={yes || undefined}>
                <Bot name={id === me.id ? me.name : name(id)} size={30} state={yes ? "happy" : "idle"} />
                <span>{name(id)}</span>
                <span className={styles.voteState}>{yes ? <><Check size={14} strokeWidth={3} aria-hidden /> In</> : "Waiting"}</span>
              </li>
            );
          })}
        </ul>
      )}
      {phase === "approve" && mine === "pending" && (
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => setMine("yes")}>Approve meetup</button>
          <button className={styles.secondary} onClick={() => setAttempt((a) => a + 1)}>Suggest another time</button>
          <button className={styles.tertiary} onClick={() => setMine("no")}>Can&apos;t make it</button>
        </div>
      )}
      {phase === "approve" && mine === "yes" && <p className={styles.waiting}>You&apos;re in. Waiting for the others…</p>}
      {phase === "confirmed" && (
        <div className={styles.actions}>
          <button className={styles.primary} onClick={addToCalendar}>
            <CalendarPlus size={18} aria-hidden /> Add to calendar
          </button>
          <p className={styles.waiting}>Bring your {give?.item ?? "item"}. Your bot will remind you.</p>
        </div>
      )}
      {phase === "declined" && (
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={() => setMine("pending")}>Undo</button>
        </div>
      )}
    </motion.section>
  );
}
