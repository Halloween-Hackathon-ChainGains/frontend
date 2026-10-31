import { FIRST_NAMES, ITEMS, ITEM_VALUES, LOOP_MESSAGES, mulberry32 } from "./fixtures";
import type { JoinRequest, Loop, Person, Trade, TownData } from "./types";

/**
 * In-browser simulator shaped exactly like /api/loops. One instance per tab.
 * People arrive every few seconds; every so often a group of 2–5 unmatched
 * people is rewritten into a cycle and emitted as a loop.
 */

const valueOf = (item: string) => ITEM_VALUES[item.toLowerCase()] ?? 30;

class MockTown {
  private rand = mulberry32(20261031);
  private people: Person[] = [];
  private loops: Loop[] = [];
  private nameIndex = 0;
  private timers: ReturnType<typeof setInterval>[] = [];
  private pendingMe: { id: string; due: number; partners?: string[] } | null = null;
  private started = false;
  private seq = 0;

  start(initialPeople = 24, initialLoops = 3) {
    if (this.started) return;
    this.started = true;
    for (let i = 0; i < initialPeople; i++) this.addRandomPerson(Date.now() - (initialPeople - i) * 60_000);
    for (let i = 0; i < initialLoops; i++) this.emitLoop(2 + i);
    this.timers.push(setInterval(() => this.tick(), 1000));
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.started = false;
  }

  reset() {
    this.people = [];
    this.loops = [];
    this.nameIndex = 0;
    this.pendingMe = null;
  }

  private tickCount = 0;
  private tick() {
    this.tickCount++;
    if (this.tickCount % 3 === 0 && this.people.length < 80) this.addRandomPerson();
    if (this.tickCount % 14 === 0) this.emitLoop(2 + Math.floor(this.rand() * 4));
    if (this.pendingMe && Date.now() >= this.pendingMe.due) {
      this.emitLoopWith(this.pendingMe.id, this.pendingMe.partners);
      this.pendingMe = null;
    }
  }

  private pickItems(n: number, avoid: string[] = []) {
    const out: string[] = [];
    while (out.length < n) {
      // Skew toward popular items so possible-trade edges (and chats) are plentiful.
      const pool = this.rand() < 0.7 ? 12 : ITEMS.length;
      const it = ITEMS[Math.floor(this.rand() * pool)];
      if (!out.includes(it) && !avoid.includes(it)) out.push(it);
    }
    return out;
  }

  private addRandomPerson(createdAt = Date.now()) {
    const name = FIRST_NAMES[this.nameIndex++ % FIRST_NAMES.length] +
      (this.nameIndex > FIRST_NAMES.length ? ` ${String.fromCharCode(65 + (this.nameIndex % 26))}.` : "");
    const have = this.pickItems(1 + Math.floor(this.rand() * 2));
    const want = this.pickItems(1 + Math.floor(this.rand() * 2), have);
    this.people.push({ id: `p${++this.seq}`, name, have, want, createdAt });
  }

  private unmatched() {
    const inLoop = new Set(this.loops.flatMap((l) => l.trades.map((t) => t.from)));
    return this.people.filter((p) => !inLoop.has(p.id));
  }

  /** Turn `k` unmatched people into a cycle by aligning one want with the next person's have. */
  private emitLoop(k: number) {
    const pool = this.unmatched().sort(() => this.rand() - 0.5);
    if (pool.length < k) return;
    this.makeLoop(pool.slice(0, k));
  }

  private emitLoopWith(meId: string, partners?: string[]) {
    const me = this.people.find((p) => p.id === meId);
    if (!me) return;
    const planted = (partners ?? []).map((id) => this.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
    const others = planted.length === 2
      ? planted
      : this.unmatched().filter((p) => p.id !== meId).sort(() => this.rand() - 0.5).slice(0, 2);
    while (others.length < 2) {
      this.addRandomPerson();
      others.push(this.people[this.people.length - 1]);
    }
    this.makeLoop([me, ...others], true);
  }

  private makeLoop(members: Person[], keepFirst = false) {
    const trades: Trade[] = members.map((giver, i) => {
      const receiver = members[(i + 1) % members.length];
      const item = giver.have[0];
      if (!(keepFirst && receiver === members[0]) && !receiver.want.includes(item)) {
        receiver.want = [item, ...receiver.want].slice(0, 5);
      }
      return { from: giver.id, to: receiver.id, item, value: valueOf(item) };
    });
    if (keepFirst) {
      // The last giver must give "me" something I actually asked for.
      const last = members[members.length - 1];
      const wanted = members[0].want[0];
      if (!last.have.includes(wanted)) last.have = [wanted, ...last.have].slice(0, 5);
      trades[trades.length - 1] = { from: last.id, to: members[0].id, item: wanted, value: valueOf(wanted) };
    }
    this.loops.push({
      id: `L${++this.seq}`,
      trades,
      message: LOOP_MESSAGES[Math.floor(this.rand() * LOOP_MESSAGES.length)],
      createdAt: Date.now(),
    });
  }

  join(req: JoinRequest): string {
    const id = `mock-me-${++this.seq}`;
    // Plant a believable story: one bot wants what I have, another has what I want.
    // They're who my bot chats with, and they close the loop: me → wantsMine → hasMine → me.
    const pool = this.unmatched().sort(() => this.rand() - 0.5);
    while (pool.length < 2) {
      this.addRandomPerson();
      pool.push(this.people[this.people.length - 1]);
    }
    const [wantsMine, hasMine] = pool;
    if (req.have[0]) wantsMine.want = [req.have[0], ...wantsMine.want.filter((w) => w !== req.have[0])].slice(0, 5);
    if (req.want[0]) hasMine.have = [req.want[0], ...hasMine.have.filter((h) => h !== req.want[0])].slice(0, 5);
    this.people.push({ id, name: req.name, have: req.have, want: req.want, createdAt: Date.now() });
    // Long enough for the scouting chats to play out on the phone first.
    this.pendingMe = { id, due: Date.now() + 16000, partners: [wantsMine.id, hasMine.id] };
    return id;
  }

  /** Ensure a stored mock id still exists (e.g. after a reload of the phone tab). */
  ensurePerson(id: string, name: string) {
    if (this.people.some((p) => p.id === id)) return;
    this.people.push({ id, name, have: this.pickItems(1), want: this.pickItems(1), createdAt: Date.now() });
    if (!this.loops.some((l) => l.trades.some((t) => t.from === id))) this.pendingMe = { id, due: Date.now() + 16000 };
  }

  snapshot(): TownData {
    const trades: Trade[] = [];
    // Possible trades: someone has what someone else wants. Capped per person so 80 people stay readable.
    for (const giver of this.people) {
      let n = 0;
      for (const receiver of this.people) {
        if (giver === receiver || n >= 3) continue;
        const item = giver.have.find((h) => receiver.want.some((w) => w.toLowerCase() === h.toLowerCase()));
        if (item) {
          trades.push({ from: giver.id, to: receiver.id, item, value: valueOf(item) });
          n++;
        }
      }
    }
    const loopTrades = this.loops.flatMap((l) => l.trades);
    return {
      people: this.people.map((p) => ({ ...p, have: [...p.have], want: [...p.want] })),
      trades,
      loops: this.loops.map((l) => ({ ...l, trades: l.trades.map((t) => ({ ...t })) })),
      stats: {
        valueTraded: loopTrades.reduce((s, t) => s + (t.value ?? 0), 0),
        itemsReused: loopTrades.length,
        people: this.people.length,
      },
    };
  }
}

let instance: MockTown | null = null;
export function mockTown() {
  if (!instance) instance = new MockTown();
  return instance;
}
