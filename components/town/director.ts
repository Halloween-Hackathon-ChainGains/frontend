import { animate } from "motion";
import { tradeKey } from "../data/adapt";
import type { Loop, Person, Trade, TownData } from "../data/types";
import { genomeFor, MASCOT, type Genome } from "../bots/genome";
import { spring } from "../motion/springs";
import { loopColorFor, releaseLoopColors } from "./loopColors";
import { arrivalLine, chatScript, cheer, greeting, loopLine } from "./lines";
import { clampToWorld, DEAL_CIRCLES, PLAZA, SPAWN, WAYPOINTS } from "./townMap";

/**
 * Client-side state machine per bot. Driven only by real data: who exists,
 * which possible trades exist, which loops were found. It sets steer targets
 * and speech; the force simulation does the walking.
 */

export type Mode = "arrive" | "wander" | "pause" | "chat" | "gather" | "ring" | "settle" | "settled" | "thrown" | "home";

export interface SimNode {
  id: string;
  name: string;
  person?: Person;
  genome: Genome;
  mascot?: boolean;
  // d3 fields
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  // steering
  tx: number;
  ty: number;
  maxSpeed: number;
  mode: Mode;
  resumeMode?: Mode;
  until: number;
  // presentation
  dist: number;
  facing: 1 | -1;
  /** Face this x while standing (chat partner, ring centre). */
  faceX?: number;
  blinkAt: number;
  blinkUntil: number;
  talkUntil: number;
  happyUntil: number;
  hopAt: number;
  waveUntil: number;
  fade: number;
  loopId?: string;
  tint?: string;
  chatCooldown: number;
  activity: string;
  lines: string[];
}

export interface SimLink {
  key: string;
  source: string | SimNode;
  target: string | SimNode;
  item: string;
  loopId?: string;
}

export interface Bubble {
  id: number;
  nodeId: string;
  text: string;
  until: number;
  s: number;
  o: number;
  leaving?: boolean;
}

interface Show {
  loop: Loop;
  phase: "gather" | "speak" | "cheer" | "settle";
  phaseAt: number;
  members: string[];
  circle: number;
}

export interface DirectorEvents {
  onLoopStart?: (loop: Loop, color: string, memberIds: string[]) => void;
  onRingFormed?: (loop: Loop, memberIds: string[]) => void;
  onLoopDone?: (loop: Loop) => void;
  onTopology?: () => void;
}

const BASE_SPEED = 1.15;
const MAX_CHATS = 3;
const now = () => performance.now();
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const idOf = (x: string | SimNode) => (typeof x === "object" ? x.id : x);
const MASCOT_ID = "__mascot__";

let bubbleSeq = 0;

export class Director {
  nodes = new Map<string, SimNode>();
  links = new Map<string, SimLink>();
  bubbles: Bubble[] = [];
  reduced = false;
  /** Loop ids whose edges are lit (already played or seen on first load). */
  revealed = new Set<string>();
  /** Loop id → deal circle index. */
  circles = new Map<string, number>();
  loops: Loop[] = [];
  private seen = new Set<string>();
  private queue: Loop[] = [];
  private show: Show | null = null;
  private chats: { a: string; b: string; item: string; step: number; nextAt: number; script: ReturnType<typeof chatScript>; met: boolean; startedAt: number }[] = [];
  private first = true;
  private nextChatAt = 0;
  private nextGreetAt = 0;
  private events: DirectorEvents;
  private possible: Trade[] = [];

  constructor(events: DirectorEvents = {}) {
    this.events = events;
  }

  setEvents(e: DirectorEvents) {
    this.events = e;
  }

  get activeLoopId() {
    return this.show?.loop.id ?? null;
  }

  // ───────────────────────────── data in ─────────────────────────────

  /** Apply a poll. Returns true when topology (nodes or links) changed. */
  update(data: TownData): boolean {
    let changed = false;
    const t = now();
    const ids = new Set(data.people.map((p) => p.id));

    // Mascot appears only in an empty town.
    if (data.people.length === 0 && !this.nodes.has(MASCOT_ID)) {
      this.nodes.set(MASCOT_ID, this.makeNode(MASCOT_ID, "Loop", MASCOT, SPAWN.x + 60, SPAWN.y, true));
      changed = true;
    } else if (data.people.length > 0 && this.nodes.has(MASCOT_ID)) {
      this.nodes.delete(MASCOT_ID);
      this.bubbles = this.bubbles.filter((b) => b.nodeId !== MASCOT_ID);
      changed = true;
    }

    for (const p of data.people) {
      const n = this.nodes.get(p.id);
      if (n) {
        n.person = p;
        n.name = p.name;
        continue;
      }
      const g = genomeFor(p.name);
      let node: SimNode;
      if (this.first || this.reduced) {
        const w = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        node = this.makeNode(p.id, p.name, g, w.x + rand(-20, 20), w.y + rand(-20, 20));
        node.mode = this.reduced ? "home" : "pause";
        node.until = t + rand(200, 3000);
        node.fade = this.first ? 1 : 0;
        if (!this.first) animate(0, 1, { duration: 0.2, onUpdate: (v) => (node.fade = v) });
      } else {
        node = this.makeNode(p.id, p.name, g, SPAWN.x, SPAWN.y + rand(-14, 14));
        node.mode = "arrive";
        const w = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        node.tx = -560 + rand(-10, 30);
        node.ty = rand(-18, 18);
        node.until = t + 9000;
        node.activity = "Walking into town";
        node.waveUntil = t + 1400;
        node.resumeMode = "wander";
        void w;
        setTimeout(() => this.say(node.id, arrivalLine(p.have)), 600);
      }
      node.person = p;
      this.nodes.set(p.id, node);
      changed = true;
    }
    for (const id of [...this.nodes.keys()]) {
      if (id !== MASCOT_ID && !ids.has(id)) {
        this.nodes.delete(id);
        this.bubbles = this.bubbles.filter((b) => b.nodeId !== id);
        changed = true;
      }
    }

    // Links: possible trades plus loop trades, keyed by from->to:item.
    this.possible = data.trades.filter((tr) => ids.has(tr.from) && ids.has(tr.to) && tr.from !== tr.to);
    const nextLinks = new Map<string, SimLink>();
    const addLink = (tr: Trade, loopId?: string) => {
      if (!ids.has(tr.from) || !ids.has(tr.to) || tr.from === tr.to) return;
      const key = tradeKey(tr);
      const prev = this.links.get(key) ?? nextLinks.get(key);
      const link: SimLink = prev ?? { key, source: tr.from, target: tr.to, item: tr.item };
      if (loopId) link.loopId = loopId;
      else if (!nextLinks.has(key)) link.loopId = undefined;
      nextLinks.set(key, link);
    };
    for (const tr of this.possible) addLink(tr);
    for (const l of data.loops) for (const tr of l.trades) addLink(tr, l.id);
    if (nextLinks.size !== this.links.size || [...nextLinks.keys()].some((k) => !this.links.has(k))) changed = true;
    this.links = nextLinks;

    // Loops.
    this.loops = data.loops;
    for (const l of data.loops) loopColorFor(l.id, this.activeLoopIds());
    if (this.first) {
      for (const l of data.loops) {
        this.seen.add(l.id);
        this.revealed.add(l.id);
      }
      this.assignMemberships(true);
    } else {
      for (const l of data.loops) {
        if (this.seen.has(l.id)) continue;
        this.seen.add(l.id);
        this.queue.push(l);
      }
    }
    releaseLoopColors(this.activeLoopIds());
    this.first = false;
    if (changed) this.events.onTopology?.();
    return changed;
  }

  /** Loop ids that still have at least one member standing with them. */
  activeLoopIds() {
    const s = new Set<string>();
    for (const n of this.nodes.values()) if (n.loopId) s.add(n.loopId);
    if (this.show) s.add(this.show.loop.id);
    for (const q of this.queue) s.add(q.id);
    return s;
  }

  /** Put revealed loop members at their newest revealed loop's deal circle. */
  private assignMemberships(instant: boolean) {
    for (const l of this.loops) {
      if (!this.revealed.has(l.id)) continue;
      const members = l.trades.map((t) => t.from);
      if (!members.every((m) => this.nodes.has(m))) continue;
      if (!this.circles.has(l.id)) this.circles.set(l.id, this.freeCircle());
      members.forEach((m, i) => {
        const n = this.nodes.get(m)!;
        n.loopId = l.id;
        n.tint = loopColorFor(l.id);
        const slot = this.circleSlot(l.id, i, members.length);
        n.tx = slot.x;
        n.ty = slot.y;
        n.faceX = slot.cx;
        n.mode = "settled";
        n.activity = "Settled with their loop";
        if (instant) {
          n.x = slot.x;
          n.y = slot.y;
        }
      });
    }
  }

  private freeCircle() {
    const used = new Map<number, number>();
    const active = this.activeLoopIds();
    for (const [lid, c] of this.circles) if (active.has(lid)) used.set(c, (used.get(c) ?? 0) + 1);
    for (let i = 0; i < DEAL_CIRCLES.length; i++) if (!used.has(i)) return i;
    // More loops than circles: share the least-used circle (rings nest by radius).
    let best = 0;
    for (let i = 1; i < DEAL_CIRCLES.length; i++) if ((used.get(i) ?? 0) < (used.get(best) ?? 0)) best = i;
    return best;
  }

  private circleSlot(loopId: string, i: number, n: number) {
    const c = DEAL_CIRCLES[this.circles.get(loopId) ?? 0];
    const sharing = [...this.circles.entries()].filter(([, ci]) => ci === this.circles.get(loopId));
    const nest = Math.max(0, sharing.findIndex(([lid]) => lid === loopId));
    const r = (n <= 2 ? 26 : 22 + n * 7) + nest * 18;
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, cx: c.x };
  }

  private makeNode(id: string, name: string, genome: Genome, x: number, y: number, mascot = false): SimNode {
    const t = now();
    return {
      id, name, genome, mascot,
      x, y, vx: 0, vy: 0,
      tx: x, ty: y,
      maxSpeed: BASE_SPEED * genome.speed,
      mode: mascot ? "home" : "wander",
      until: 0,
      dist: 0,
      facing: 1,
      blinkAt: t + rand(3000, 6000),
      blinkUntil: 0,
      talkUntil: 0,
      happyUntil: 0,
      hopAt: 0,
      waveUntil: 0,
      fade: 1,
      chatCooldown: t + rand(2000, 8000),
      activity: "Wandering",
      lines: [],
    };
  }

  // ───────────────────────────── speech ─────────────────────────────

  say(nodeId: string, text: string, ms = 2600) {
    const n = this.nodes.get(nodeId);
    if (!n) return;
    // One bubble per speaker: replace the old one.
    for (const b of this.bubbles) if (b.nodeId === nodeId && !b.leaving) this.dismiss(b);
    const t = now();
    const b: Bubble = { id: ++bubbleSeq, nodeId, text, until: t + ms, s: this.reduced ? 1 : 0.6, o: 0 };
    this.bubbles.push(b);
    if (this.reduced) animate(0, 1, { duration: 0.2, onUpdate: (v) => (b.o = v) });
    else {
      animate(0.6, 1, { ...spring.quick, onUpdate: (v) => (b.s = v) });
      animate(0, 1, { duration: 0.15, onUpdate: (v) => (b.o = v) });
    }
    n.talkUntil = t + Math.min(ms, 1400);
    n.lines = [text, ...n.lines].slice(0, 4);
  }

  private dismiss(b: Bubble) {
    b.leaving = true;
    animate(b.o, 0, {
      duration: 0.18,
      onUpdate: (v) => (b.o = v),
      onComplete: () => (this.bubbles = this.bubbles.filter((x) => x !== b)),
    });
  }

  // ───────────────────────────── per frame ─────────────────────────────

  tick() {
    const t = now();
    for (const b of this.bubbles) if (!b.leaving && t > b.until) this.dismiss(b);
    this.runShow(t);
    this.runChats(t);
    for (const n of this.nodes.values()) this.runNode(n, t);
  }

  private runNode(n: SimNode, t: number) {
    // Blink.
    if (t > n.blinkAt) {
      n.blinkUntil = t + 140;
      n.blinkAt = t + rand(3000, 6000);
    }
    const speed = Math.hypot(n.vx, n.vy);
    n.dist += speed;
    if (speed > 0.25 && n.fx === undefined) n.facing = n.vx >= 0 ? 1 : -1;
    else if (n.faceX !== undefined && speed < 0.2) n.facing = n.faceX >= n.x ? 1 : -1;

    switch (n.mode) {
      case "home":
        if (n.mascot) {
          if (t > n.until) {
            n.waveUntil = t + 1600;
            this.say(n.id, "Scan to join. Your bot is waiting.", 5200);
            n.until = t + 7000;
          }
        }
        break;
      case "arrive":
        if (this.near(n, 14) || t > n.until) this.toWander(n, t);
        break;
      case "wander":
        if (this.near(n, 10)) {
          n.mode = "pause";
          n.until = t + rand(1000, 4000);
          n.activity = "Taking in the town";
        }
        break;
      case "pause":
        if (t > n.until) this.toWander(n, t);
        break;
      case "thrown":
        if (speed < 0.15 && t > n.until) {
          const back = n.resumeMode ?? "wander";
          if (back === "wander" || back === "pause" || back === "chat") this.toWander(n, t);
          else n.mode = back;
        }
        break;
      default:
        break;
    }
  }

  private toWander(n: SimNode, t: number) {
    if (this.reduced) {
      n.mode = "home";
      return;
    }
    // Prefer a nearby waypoint so walks stay short and readable.
    let best = WAYPOINTS[0];
    let bestScore = Infinity;
    for (let i = 0; i < 6; i++) {
      const w = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
      const d = Math.hypot(w.x - n.x, w.y - n.y);
      const score = Math.abs(d - 260) + Math.random() * 80;
      if (score < bestScore) {
        bestScore = score;
        best = w;
      }
    }
    n.mode = "wander";
    n.tx = best.x + rand(-16, 16);
    n.ty = best.y + rand(-16, 16);
    n.faceX = undefined;
    n.until = t + 15000;
    n.activity = "Wandering";
  }

  private near(n: SimNode, d: number) {
    return Math.hypot(n.tx - n.x, n.ty - n.y) < d;
  }

  private free(n: SimNode | undefined, t: number) {
    return !!n && !n.loopId && !n.mascot && (n.mode === "wander" || n.mode === "pause") && t > n.chatCooldown && n.fx === undefined;
  }

  // ───────────────────────────── chats ─────────────────────────────

  private runChats(t: number) {
    // Start a chat now and then along a possible-trade edge between two unmatched bots.
    if (t > this.nextChatAt && this.chats.length < MAX_CHATS && !this.reduced) {
      this.nextChatAt = t + rand(900, 2200);
      const candidates = this.possible.filter((tr) => {
        const a = this.nodes.get(tr.to);
        const b = this.nodes.get(tr.from);
        return this.free(a, t) && this.free(b, t) && Math.hypot(a!.x - b!.x, a!.y - b!.y) < 700;
      });
      if (candidates.length) {
        const tr = candidates[Math.floor(Math.random() * candidates.length)];
        const a = this.nodes.get(tr.to)!; // asker
        const b = this.nodes.get(tr.from)!; // giver
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const p = clampToWorld(mx, my, 60);
        const left = a.x < b.x ? a : b;
        const right = left === a ? b : a;
        left.tx = p.x - 30; left.ty = p.y;
        right.tx = p.x + 30; right.ty = p.y;
        for (const n of [a, b]) {
          n.mode = "chat";
          n.until = t + 9000;
          n.faceX = (n === left ? p.x + 30 : p.x - 30);
        }
        a.activity = `Asking ${b.name} about a ${tr.item}`;
        b.activity = `Telling ${a.name} about their ${tr.item}`;
        this.chats.push({ a: a.id, b: b.id, item: tr.item, step: 0, nextAt: 0, script: chatScript(tr.item, a.name, b.name), met: false, startedAt: t });
      }
    }

    // Ambient greetings between free bots who happen to pass each other.
    if (t > this.nextGreetAt && !this.reduced) {
      this.nextGreetAt = t + rand(2500, 5000);
      const free = [...this.nodes.values()].filter((n) => this.free(n, t) && n.talkUntil < t);
      outer: for (const a of free) {
        for (const b of free) {
          if (a === b) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) < 80) {
            this.say(a.id, greeting(), 1800);
            a.chatCooldown = t + 6000;
            b.chatCooldown = t + 6000;
            setTimeout(() => this.nodes.has(b.id) && this.say(b.id, greeting(), 1600), 700);
            break outer;
          }
        }
      }
    }

    this.chats = this.chats.filter((c) => {
      const a = this.nodes.get(c.a);
      const b = this.nodes.get(c.b);
      const end = () => {
        for (const n of [a, b]) {
          if (!n || n.mode !== "chat") continue;
          n.chatCooldown = t + rand(14000, 24000);
          n.faceX = undefined;
          this.toWander(n, t);
        }
        return false;
      };
      if (!a || !b || a.mode !== "chat" || b.mode !== "chat") return end();
      if (!c.met) {
        if ((this.near(a, 12) && this.near(b, 12)) || t - c.startedAt > 7000) {
          c.met = true;
          c.nextAt = t + 150;
        }
        return true;
      }
      if (t < c.nextAt) return true;
      if (c.step >= c.script.length) return end();
      const line = c.script[c.step++];
      this.say(line.who === "asker" ? a.id : b.id, line.text, 1700);
      c.nextAt = t + 1300;
      return true;
    });
  }

  // ───────────────────────────── loop found ─────────────────────────────

  private runShow(t: number) {
    if (!this.show) {
      const next = this.queue.shift();
      if (!next) return;
      const members = next.trades.map((tr) => tr.from);
      if (!members.every((m) => this.nodes.has(m))) {
        // Members not here yet (rare); retry on a later frame.
        this.queue.push(next);
        return;
      }
      this.startShow(next, members, t);
      return;
    }
    const s = this.show;
    const nodes = s.members.map((m) => this.nodes.get(m)).filter((n): n is SimNode => !!n);
    if (nodes.length !== s.members.length) {
      this.finishShow();
      return;
    }
    const dt = t - s.phaseAt;
    if (s.phase === "gather") {
      const ready = nodes.every((n) => this.near(n, 14) && n.mode !== "thrown");
      if (ready || dt > 9000) {
        s.phase = "speak";
        s.phaseAt = t;
        this.events.onRingFormed?.(s.loop, s.members);
      }
    } else if (s.phase === "speak") {
      const step = 1250;
      const i = Math.floor(dt / step);
      const said = (s as Show & { said?: number }).said ?? -1;
      if (i > said && i < s.loop.trades.length) {
        (s as Show & { said?: number }).said = i;
        const tr = s.loop.trades[i];
        const to = this.nodes.get(tr.to);
        this.say(tr.from, loopLine(tr.item, to?.name ?? "friend"), 2200);
        this.nodes.get(tr.from)!.activity = `Giving ${tr.item} to ${to?.name ?? "someone"}`;
      }
      if (dt > s.loop.trades.length * step + 600) {
        s.phase = "cheer";
        s.phaseAt = t;
        nodes.forEach((n, k) => {
          n.happyUntil = t + 2600;
          if (!this.reduced) n.hopAt = t + k * 130;
        });
        this.say(nodes[0].id, cheer(), 1800);
      }
    } else if (s.phase === "cheer") {
      if (dt > 2200) {
        s.phase = "settle";
        s.phaseAt = t;
        nodes.forEach((n, i) => {
          const slot = this.circleSlot(s.loop.id, i, nodes.length);
          n.tx = slot.x;
          n.ty = slot.y;
          n.faceX = slot.cx;
          n.mode = "settle";
          n.activity = "Walking to their deal circle";
          if (this.reduced) this.crossFadeTo(n, slot.x, slot.y);
        });
      }
    } else if (s.phase === "settle") {
      if (nodes.every((n) => this.near(n, 16)) || dt > 9000) {
        nodes.forEach((n) => {
          n.mode = "settled";
          n.activity = "Settled with their loop";
        });
        this.finishShow();
      }
    }
  }

  private startShow(loop: Loop, members: string[], t: number) {
    const color = loopColorFor(loop.id, this.activeLoopIds());
    this.circles.set(loop.id, this.freeCircle());
    this.show = { loop, phase: "gather", phaseAt: t, members, circle: this.circles.get(loop.id)! };
    this.revealed.add(loop.id);
    // Drop chats involving members.
    this.chats = this.chats.filter((c) => !members.includes(c.a) && !members.includes(c.b));
    const n = members.length;
    const r = Math.max(62, Math.min(PLAZA.r - 30, 26 + n * 16));
    members.forEach((id, i) => {
      const node = this.nodes.get(id)!;
      // Ring in trade order, clockwise, so each trade points to the next bot around.
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      node.loopId = loop.id;
      node.tint = color;
      node.mode = "gather";
      node.tx = Math.cos(a) * r;
      node.ty = Math.sin(a) * r;
      node.faceX = 0;
      node.activity = "Heading to the plaza";
      if (this.reduced) this.crossFadeTo(node, node.tx, node.ty);
    });
    this.events.onLoopStart?.(loop, color, members);
  }

  private crossFadeTo(n: SimNode, x: number, y: number) {
    animate(n.fade, 0, {
      duration: 0.1,
      onUpdate: (v) => (n.fade = v),
      onComplete: () => {
        n.x = x;
        n.y = y;
        n.vx = 0;
        n.vy = 0;
        animate(0, 1, { duration: 0.1, onUpdate: (v) => (n.fade = v) });
      },
    });
  }

  private finishShow() {
    const s = this.show;
    this.show = null;
    if (s) this.events.onLoopDone?.(s.loop);
  }

  // ───────────────────────────── interaction ─────────────────────────────

  throwNode(n: SimNode, vx: number, vy: number) {
    n.fx = undefined;
    n.fy = undefined;
    if (this.reduced) {
      n.vx = 0;
      n.vy = 0;
    } else {
      n.vx = vx;
      n.vy = vy;
    }
    if (n.mode !== "thrown") n.resumeMode = n.mode === "pause" || n.mode === "wander" || n.mode === "chat" ? "wander" : n.mode;
    n.mode = "thrown";
    n.until = now() + 400;
    n.activity = "Recovering from a throw";
    n.happyUntil = now() + 900;
  }

  setReduced(r: boolean) {
    this.reduced = r;
    if (r) for (const n of this.nodes.values()) if (n.mode === "wander" || n.mode === "pause") n.mode = "home";
  }

  linkIds(l: SimLink) {
    return { s: idOf(l.source), t: idOf(l.target) };
  }
}
