"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bot } from "../bots/Bot";
import { Mascot } from "../bots/Mascot";
import { adaptJoinResponse } from "../data/adapt";
import { mockTown } from "../data/mock";
import { useLoops } from "../data/useLoops";
import { reducedFade, spring } from "../motion/springs";
import { ChipInput } from "./ChipInput";
import { Feed, Stepper, useStory, type Phase } from "./BotStory";
import type { Me } from "./story";
import { GateStrip } from "./GateStrip";
import styles from "./Join.module.css";

const KEY_ID = "loop:personId";
const KEY_NAME = "loop:name";
const KEY_PROFILE = "loop:profile";
const isDev = process.env.NODE_ENV !== "production";

type Field = "name" | "have" | "want" | null;

function readStored() {
  try {
    const id = localStorage.getItem(KEY_ID);
    const name = localStorage.getItem(KEY_NAME);
    return id ? { id, name: name ?? "" } : null;
  } catch {
    return null;
  }
}

export function JoinFlow() {
  const params = useSearchParams();
  const forceMock = params.get("mock") === "1";
  const reduced = !!useReducedMotion();
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [usedMock, setUsedMock] = useState(forceMock);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = readStored();
    if (s) {
      setMe(s);
      if (s.id.startsWith("mock-")) {
        setUsedMock(true);
        mockTown().start();
        mockTown().ensurePerson(s.id, s.name);
      }
    }
    setHydrated(true);
  }, []);

  const startOver = () => {
    try {
      localStorage.removeItem(KEY_ID);
      localStorage.removeItem(KEY_NAME);
      localStorage.removeItem(KEY_PROFILE);
    } catch {}
    setMe(null);
  };

  if (!hydrated) return <div className={styles.page} />;

  return (
    <LayoutGroup>
      <div className={styles.page}>
        <header className={styles.top}>
          <Mascot size={36} />
          <span className={styles.wordmark}>Loop</span>
        </header>
        <AnimatePresence mode="popLayout" initial={false}>
          {me ? (
            <Joined key="joined" me={me} mock={usedMock} reduced={reduced} onStartOver={startOver} />
          ) : (
            <JoinForm
              key="form"
              reduced={reduced}
              forceMock={forceMock}
              onJoined={(id, name, mock, profile) => {
                try {
                  localStorage.setItem(KEY_ID, id);
                  localStorage.setItem(KEY_NAME, name);
                  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
                } catch {}
                setUsedMock(mock);
                setMe({ id, name });
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

function JoinForm({ reduced, forceMock, onJoined }: { reduced: boolean; forceMock: boolean; onJoined: (id: string, name: string, mock: boolean, profile: { have: string[]; want: string[] }) => void }) {
  const [name, setName] = useState("");
  const [seedName, setSeedName] = useState("");
  const [have, setHave] = useState<string[]>([]);
  const [want, setWant] = useState<string[]>([]);
  const [focus, setFocus] = useState<Field>(null);
  const [sending, setSending] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  const errs = {
    name: !name.trim() ? "Add your name." : null,
    have: have.length === 0 ? "Add at least one thing you have." : null,
    want: want.length === 0 ? "Add at least one thing you want." : null,
  };
  const valid = !errs.name && !errs.have && !errs.want;

  // Pupils look toward whichever field has focus.
  useEffect(() => {
    if (!focus || !botRef.current) {
      setLook({ x: 0, y: 0 });
      return;
    }
    const el = document.getElementById(`join-${focus}`);
    if (!el) return;
    const b = botRef.current.getBoundingClientRect();
    const f = el.getBoundingClientRect();
    const dx = f.left + Math.min(f.width, 120) / 2 - (b.left + b.width / 2);
    const dy = f.top + f.height / 2 - (b.top + b.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    setLook({ x: dx / m, y: dy / m });
  }, [focus]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    const body = { name: name.trim(), have, want };
    const joinMock = () => {
      const sim = mockTown();
      sim.start();
      return sim.join(body);
    };
    try {
      if (forceMock) {
        onJoined(joinMock(), body.name, true, body);
        return;
      }
      const res = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        if (isDev && (res.status === 404 || res.status >= 500)) {
          onJoined(joinMock(), body.name, true, body);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const id = adaptJoinResponse(await res.json());
      if (!id) throw new Error("No id in response");
      onJoined(id, body.name, false, body);
    } catch (err) {
      if (isDev && err instanceof TypeError) {
        onJoined(joinMock(), body.name, true, body);
        return;
      }
      setError("Couldn't reach the town. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const bubble = have.length || want.length
    ? `Got: ${have.join(", ") || "…"} · Want: ${want.join(", ") || "…"}`
    : seedName ? `Hi, I'm ${seedName}'s bot!` : "Type your name to build me.";

  return (
    <motion.form
      className={styles.form}
      onSubmit={submit}
      noValidate
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? reducedFade : spring.default}
    >
      <h1 className={styles.headline}>Tell your bot what you need.</h1>
      <p className={styles.sub}>It walks into town, talks to other bots, and finds a loop where everyone gets something.</p>
      <div className={styles.preview}>
        <motion.div layoutId={reduced ? undefined : "me-bot"} ref={botRef} className={styles.previewBot} transition={spring.default}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={seedName || "blank"}
              initial={reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.9)" }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: 0 }}
              transition={reduced ? reducedFade : spring.default}
            >
              <Bot name={seedName || "loop"} size={120} state={focus ? "looking" : "idle"} look={look} label={seedName ? `${seedName}'s bot` : undefined} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <p className={styles.bubble} aria-live="polite">{bubble}</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="join-name" className={styles.label}>Your name</label>
        <input
          id="join-name"
          className={`${styles.input} ${tried && errs.name ? styles.invalid : ""}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocus("name")}
          onBlur={() => {
            setFocus(null);
            setSeedName(name.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              document.getElementById("join-have")?.focus();
            }
          }}
          autoComplete="given-name"
          enterKeyHint="next"
          maxLength={40}
          aria-invalid={(tried && !!errs.name) || undefined}
          aria-describedby={tried && errs.name ? "err-name" : undefined}
        />
        {tried && errs.name && <p id="err-name" className={styles.error}>{errs.name}</p>}
      </div>

      <ChipInput id="join-have" label="What do you have?" value={have} onChange={setHave} onFocus={() => setFocus("have")} invalid={tried && !!errs.have} errorId={tried && errs.have ? "err-have" : undefined} />
      {tried && errs.have && <p id="err-have" className={styles.error}>{errs.have}</p>}
      <ChipInput id="join-want" label="What do you want?" value={want} onChange={setWant} onFocus={() => setFocus("want")} enterKeyHint="done" invalid={tried && !!errs.want} errorId={tried && errs.want ? "err-want" : undefined} />
      {tried && errs.want && <p id="err-want" className={styles.error}>{errs.want}</p>}

      {error && (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
          <button type="submit" className={styles.retry}>Retry</button>
        </div>
      )}

      <button type="submit" className={styles.submit} disabled={sending} aria-disabled={sending}>
        {sending ? "Joining…" : "Join the loop"}
      </button>
    </motion.form>
  );
}

function Joined({ me: who, mock, reduced, onStartOver }: { me: { id: string; name: string }; mock: boolean; reduced: boolean; onStartOver: () => void }) {
  const { data, loaded } = useLoops({ mock, pauseWhenHidden: true });
  const profile = useMemo(() => readProfile(), []);
  const person = data.people.find((p) => p.id === who.id);
  const me: Me = useMemo(
    () => ({ id: who.id, name: who.name, have: person?.have ?? profile.have, want: person?.want ?? profile.want }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [who.id, who.name, person?.have.join("|"), person?.want.join("|")],
  );
  const { beats, typing } = useStory(data, me, loaded);
  const [proposalPhase, setProposalPhase] = useState<Phase>("approve");
  const buzzed = useRef(false);

  const hasLoop = beats.some((b) => b.kind === "loop");
  const hasProposal = beats.some((b) => b.kind === "proposal");
  const phase: Phase = hasProposal ? proposalPhase : hasLoop ? "loop" : "talking";

  useEffect(() => {
    if (hasLoop && !buzzed.current) {
      buzzed.current = true;
      try {
        navigator.vibrate?.(60);
      } catch {}
    }
  }, [hasLoop]);

  const lastStatus = [...beats].reverse().find((b) => b.kind === "status");
  const bubble =
    phase === "confirmed" ? "See you there!" :
    phase === "approve" ? "Approve the meetup?" :
    phase === "loop" ? "Found a loop!" :
    lastStatus && lastStatus.kind === "status" ? lastStatus.text : "Heading into town…";

  const headline = {
    talking: "Your bot is in town",
    loop: "Your bot found a loop",
    approve: "Your bot found a loop",
    confirmed: "You're all set",
    declined: "Your bot is still looking",
  }[phase];

  return (
    <motion.section
      className={styles.joined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? reducedFade : spring.default}
    >
      <Stepper phase={phase} />
      <div>
        <h1 className={styles.headline}>{headline}</h1>
        <p className={styles.sub}>
          {phase === "talking" ? "Watch it chat with other bots below, or find it on the big screen." : "Look for your bot on the big screen, glowing in its loop's color."}
        </p>
      </div>
      <GateStrip name={who.name} happy={phase !== "talking" && phase !== "declined"} bubble={bubble} reduced={reduced} />
      <Feed beats={beats} typing={typing} data={data} me={me} mock={mock} reduced={reduced} onPhase={setProposalPhase} />
      <button className={styles.startOver} onClick={onStartOver}>Not you? Start over</button>
    </motion.section>
  );
}

function readProfile(): { have: string[]; want: string[] } {
  try {
    return JSON.parse(localStorage.getItem(KEY_PROFILE) ?? "") as { have: string[]; want: string[] };
  } catch {
    return { have: [], want: [] };
  }
}
