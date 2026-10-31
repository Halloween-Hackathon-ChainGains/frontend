import type { Loop, Person, TownData } from "../data/types";

/**
 * The user's story, told by their bot: scouting chats with other bots, then
 * the loop, then a meetup proposal. Built client-side from real data (who has
 * what, who wants what, which loop includes me), so it works against the mock
 * and the real backend alike. Only the meetup approval is local for now.
 */

export type Beat =
  | { kind: "status"; text: string }
  | { kind: "msg"; fromId: string; fromName: string; text: string; mine: boolean; thread: string }
  | { kind: "loop"; loopId: string }
  | { kind: "proposal"; loopId: string };

export interface Me {
  id: string;
  name: string;
  have: string[];
  want: string[];
}

const eq = (a: string, b: string) => {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
};

/** "a calc textbook", "an android phone". */
const a = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);
const short = (s: string, n = 22) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
const first = (name: string) => name.split(" ")[0];

/** Scouting: my bot asks around for what I want and offers what I have. */
export function scoutBeats(data: TownData, me: Me): Beat[] {
  const others = data.people.filter((p) => p.id !== me.id);
  const beats: Beat[] = [{ kind: "status", text: "Walked into town. Asking around…" }];
  const used = new Set<string>();
  const say = (p: Person | "me", text: string, thread: string): Beat =>
    p === "me"
      ? { kind: "msg", fromId: me.id, fromName: me.name, text, mine: true, thread }
      : { kind: "msg", fromId: p.id, fromName: p.name, text, mine: false, thread };

  // For up to two things I want: find a bot that has it.
  for (const w of me.want.slice(0, 2)) {
    const p = others.find((o) => !used.has(o.id) && o.have.some((h) => eq(h, w)));
    if (!p) {
      beats.push({ kind: "status", text: `Nobody has ${a(short(w))} yet. Still asking…` });
      continue;
    }
    used.add(p.id);
    const thread = `${p.id}:${w}`;
    const theyWantMine = me.have.find((h) => p.want.some((pw) => eq(pw, h)));
    beats.push(
      say("me", `Hi ${first(p.name)}! Is your ${short(w)} still up for grabs?`, thread),
      say(p, "Yep! What do you have?", thread),
      say("me", `${cap(a(short(me.have[0] ?? "few things")))}. Interested?`, thread),
      theyWantMine
        ? say(p, `Ooh, I do need ${a(short(theyWantMine))}!`, thread)
        : say(p, `Not really. I'm after ${a(short(p.want[0] ?? "something else"))}.`, thread),
      theyWantMine
        ? say("me", "Let me check if a loop works for everyone.", thread)
        : say("me", "No problem. I'll find a loop that gets you one.", thread),
    );
  }

  // Someone who wants what I have.
  const h = me.have[0];
  const q = h ? others.find((o) => !used.has(o.id) && o.want.some((pw) => eq(pw, h))) : undefined;
  if (q && h) {
    used.add(q.id);
    const thread = `${q.id}:${h}`;
    beats.push(
      say(q, `Heard you have ${a(short(h))}?`, thread),
      say("me", `I do! Do you have ${a(short(me.want[0] ?? "anything"))}?`, thread),
      say(q, "Sadly no. But I'm in if there's a loop!", thread),
    );
  }

  // Sparse town: still show some life.
  if (beats.length < 4 && others.length) {
    const p = others[Math.floor(Math.random() * others.length)];
    beats.push(say(p, "Hi! New here?", `hi:${p.id}`), say("me", `Yes! Looking for ${a(short(me.want[0] ?? "good trade"))}.`, `hi:${p.id}`));
  }
  beats.push({ kind: "status", text: "Checking the plaza for a loop…" });
  return beats;
}

/** The loop itself: each giver says their line around the ring, then my bot proposes a meetup. */
export function loopBeats(loop: Loop, data: TownData, me: Me): Beat[] {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const name = (id: string) => (id === me.id ? me.name : byId.get(id)?.name ?? "Someone");
  const beats: Beat[] = [{ kind: "loop", loopId: loop.id }];
  for (const t of loop.trades) {
    const mine = t.from === me.id;
    beats.push({
      kind: "msg",
      fromId: t.from,
      fromName: name(t.from),
      mine,
      text: `${cap(short(t.item, 26))} for you, ${first(name(t.to))}!`,
      thread: `loop:${loop.id}`,
    });
  }
  beats.push(
    { kind: "msg", fromId: me.id, fromName: me.name, mine: true, text: "Everyone wins. I'll set up a meetup.", thread: `loop:${loop.id}` },
    { kind: "proposal", loopId: loop.id },
  );
  return beats;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Meetup ──

const PLACES = ["Plaza fountain", "Library steps", "Café patio", "Dorms lobby", "Lab courtyard"];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic meetup suggestion per loop; `attempt` moves to the next slot. */
export function meetupFor(loopId: string, attempt = 0) {
  const h = hash(loopId);
  const place = PLACES[(h + attempt) % PLACES.length];
  const d = new Date();
  d.setDate(d.getDate() + 1 + Math.floor(attempt / 3));
  d.setHours(12 + ((h % 6) + attempt * 2) % 8, (h >> 3) % 2 ? 30 : 0, 0, 0);
  return { place, start: d };
}

export function formatWhen(d: Date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const day = sameDay(d, today) ? "Today" : sameDay(d, tomorrow) ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "long" });
  return `${day}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** A tiny .ics for "Add to calendar". */
export function icsFor(title: string, place: string, start: Date, minutes = 20) {
  const end = new Date(start.getTime() + minutes * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loop//Meetup//EN",
    "BEGIN:VEVENT",
    `UID:${f(start)}-${hash(title + place)}@loop`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${place}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
