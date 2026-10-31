/**
 * Frontend view of the backend contract.
 *
 * lib/types.ts did not exist when this was written, so these shapes are the
 * frontend's assumption. Everything coming off the wire passes through
 * `adapt.ts`, which is the one place to reconcile field names once the real
 * lib/types.ts lands. Nothing else in components/ should read raw API JSON.
 */

export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
  have: string[];
  want: string[];
  createdAt?: number;
}

/** A directed trade: `from` gives `item` to `to`. */
export interface Trade {
  from: PersonId;
  to: PersonId;
  item: string;
  value?: number;
}

export interface Loop {
  id: string;
  /** In cycle order: trades[i].to === trades[i + 1].from, closing back to trades[0].from. */
  trades: Trade[];
  message: string;
  createdAt?: number;
}

export interface Stats {
  /** Dollar value traded across all loops. */
  valueTraded: number;
  itemsReused: number;
  people: number;
}

export interface TownData {
  people: Person[];
  /** Every possible trade (the faint edges). May or may not include loop trades. */
  trades: Trade[];
  loops: Loop[];
  stats: Stats;
}

export interface JoinRequest {
  name: string;
  have: string[];
  want: string[];
}

export const EMPTY_TOWN: TownData = {
  people: [],
  trades: [],
  loops: [],
  stats: { valueTraded: 0, itemsReused: 0, people: 0 },
};
