/**
 * Loop palette: dark-mode system hues (accessible variants where the base is
 * too dim on the navy ground). Red is skipped; it reads as an error.
 * Contrast against the town ground #101A33 in comments.
 */
export const LOOP_PALETTE = [
  "#409CFF", // blue    6.1:1
  "#30D158", // green   8.5:1
  "#FF9F0A", // orange  8.4:1
  "#FF6482", // pink    6.1:1
  "#DA8FFF", // purple  7.7:1
  "#5DE6FF", // teal    11.7:1
  "#FFD60A", // yellow  12.2:1
  "#7D7AFF", // indigo  5.0:1
];

const assigned = new Map<string, number>();
let counter = 0;

/** Stable per loop id. While ≤8 loops are active, no two share a color. */
export function loopColorFor(loopId: string, active?: Set<string>) {
  const hit = assigned.get(loopId);
  if (hit !== undefined) return LOOP_PALETTE[hit];
  const used = new Set<number>();
  if (active) for (const id of active) {
    const c = assigned.get(id);
    if (c !== undefined) used.add(c);
  }
  let idx = LOOP_PALETTE.findIndex((_, i) => !used.has(i));
  if (idx === -1) idx = counter % LOOP_PALETTE.length;
  counter++;
  assigned.set(loopId, idx);
  return LOOP_PALETTE[idx];
}

/** Kept for symmetry: colors stay stable per id once assigned, so nothing is released. */
export function releaseLoopColors(_active: Set<string>) {
  void _active;
}

export function loopNumber(loopId: string, loops: { id: string }[]) {
  return loops.findIndex((l) => l.id === loopId) + 1;
}
