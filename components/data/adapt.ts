import type { Loop, Person, Stats, Trade, TownData } from "./types";

/**
 * Tolerant parsing of /api/loops and /api/people responses.
 *
 * The backend's exact field names were unknown at build time, so each field
 * accepts the handful of spellings a backend is likely to use. Once
 * lib/types.ts exists, this can be narrowed to the real names.
 */

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null;
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

function pick(o: Raw, keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (isObj(x) ? str(pick(x, ["name", "item", "title"])) : str(x))).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function idOf(v: unknown): string {
  return isObj(v) ? str(pick(v, ["id", "personId"])) : str(v);
}

export function adaptPerson(raw: unknown): Person | null {
  if (!isObj(raw)) return null;
  const id = str(pick(raw, ["id", "personId", "_id"]));
  if (!id) return null;
  return {
    id,
    name: str(pick(raw, ["name", "displayName", "firstName"])) || "Someone",
    have: strList(pick(raw, ["have", "haves", "has", "offers", "offer", "items"])),
    want: strList(pick(raw, ["want", "wants", "needs", "wishes"])),
    createdAt: num(pick(raw, ["createdAt", "joinedAt", "ts"])) || undefined,
  };
}

export function adaptTrade(raw: unknown): Trade | null {
  if (!isObj(raw)) return null;
  const from = idOf(pick(raw, ["from", "giver", "source", "fromId"]));
  const to = idOf(pick(raw, ["to", "receiver", "target", "toId"]));
  if (!from || !to) return null;
  const value = pick(raw, ["value", "price", "usd"]);
  return {
    from,
    to,
    item: str(pick(raw, ["item", "label", "what", "name"])) || "something",
    value: value === undefined ? undefined : num(value),
  };
}

export function adaptLoop(raw: unknown, index: number): Loop | null {
  if (!isObj(raw)) return null;
  const trades = (Array.isArray(raw.trades) ? raw.trades : Array.isArray(raw.edges) ? raw.edges : [])
    .map(adaptTrade)
    .filter((t): t is Trade => t !== null);
  if (trades.length === 0) return null;
  return {
    id: str(pick(raw, ["id", "loopId"])) || `loop-${trades.map((t) => t.from).join("-")}-${index}`,
    trades: orderCycle(trades),
    message: str(pick(raw, ["message", "summary", "caption", "explanation"])),
    createdAt: num(pick(raw, ["createdAt", "foundAt", "ts"])) || undefined,
  };
}

/** Reorder so each trade's `to` is the next trade's `from`. Leaves input alone if it isn't a clean cycle. */
export function orderCycle(trades: Trade[]): Trade[] {
  if (trades.length < 2) return trades;
  const byFrom = new Map(trades.map((t) => [t.from, t]));
  const out: Trade[] = [trades[0]];
  while (out.length < trades.length) {
    const next = byFrom.get(out[out.length - 1].to);
    if (!next || out.includes(next)) return trades;
    out.push(next);
  }
  return out;
}

function adaptStats(raw: unknown, people: Person[], loops: Loop[]): Stats {
  const o = isObj(raw) ? raw : {};
  const loopTrades = loops.flatMap((l) => l.trades);
  return {
    valueTraded: num(pick(o, ["valueTraded", "dollarsTraded", "totalValue", "value", "usd", "traded"])) ||
      loopTrades.reduce((s, t) => s + (t.value ?? 0), 0),
    itemsReused: num(pick(o, ["itemsReused", "items", "reused", "itemCount"])) || loopTrades.length,
    people: num(pick(o, ["people", "peopleCount", "participants", "users"])) || people.length,
  };
}

export function adaptTown(raw: unknown): TownData {
  const o = isObj(raw) ? raw : {};
  const people = (Array.isArray(o.people) ? o.people : Array.isArray(o.persons) ? o.persons : [])
    .map(adaptPerson)
    .filter((p): p is Person => p !== null);
  const loops = (Array.isArray(o.loops) ? o.loops : Array.isArray(o.cycles) ? o.cycles : [])
    .map(adaptLoop)
    .filter((l): l is Loop => l !== null);
  const tradeSrc = pick(o, ["trades", "edges", "possibleTrades", "matches", "links"]);
  const trades = (Array.isArray(tradeSrc) ? tradeSrc : []).map(adaptTrade).filter((t): t is Trade => t !== null);
  return { people, trades, loops, stats: adaptStats(o.stats, people, loops) };
}

/** POST /api/people may return the person, `{ id }`, or `{ person }`. */
export function adaptJoinResponse(raw: unknown): string | null {
  if (!isObj(raw)) return null;
  if (isObj(raw.person)) return str(pick(raw.person, ["id", "personId"])) || null;
  return str(pick(raw, ["id", "personId"])) || null;
}

/** Normalized name, used as the bot seed so the phone bot matches the town bot. */
export function normalizeName(name: string): string {
  return name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export const tradeKey = (t: Pick<Trade, "from" | "to" | "item">) => `${t.from}->${t.to}:${t.item.toLowerCase()}`;
