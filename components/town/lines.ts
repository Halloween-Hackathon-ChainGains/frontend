/** Short speech templates (32 characters or fewer after filling). */

const fit = (s: string, max = 32) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…");

const short = (item: string, max = 16) => (item.length <= max ? item : item.slice(0, max - 1).trimEnd() + "…");

function pick<T>(xs: T[], r = Math.random) {
  return xs[Math.floor(r() * xs.length)];
}

/** A chat about a possible trade: `asker` wants `item`, `giver` has it. Lines alternate asker, giver, asker, giver. */
export function chatScript(item: string, askerName: string, giverName: string): { who: "asker" | "giver"; text: string }[] {
  const it = short(item);
  const ask = pick([
    `Anyone got a ${it}?`,
    `I need a ${it}!`,
    `Still hunting a ${it}…`,
    `Is that a ${it}?`,
    `Looking for a ${it}`,
  ]);
  const answer = pick([
    "I do!",
    `Got one, ${short(askerName, 10)}!`,
    "Mine's barely used.",
    "Right here!",
    "Yep, it's yours-ish.",
  ]);
  const follow = pick([
    "What do you want for it?",
    "Swap for something?",
    "Amazing. What do you need?",
    "Wait, really?",
  ]);
  const close = pick([
    "Let's find a loop.",
    "Let Loop sort it out.",
    "I'll ping the plaza.",
    `Need a 3rd, ${short(giverName, 10)}…`,
    "Deal, if it loops!",
  ]);
  return [
    { who: "asker", text: fit(ask) },
    { who: "giver", text: fit(answer) },
    { who: "asker", text: fit(follow) },
    { who: "giver", text: fit(close) },
  ];
}

export function greeting() {
  return fit(pick(["Hi!", "Hey there!", "Nice antenna.", "Love the visor.", "Busy night!", "Big plaza energy.", "First time here?"]));
}

export function arrivalLine(have: string[]) {
  if (have[0]) return fit(pick([`Who needs a ${short(have[0])}?`, `Got a ${short(have[0])} to swap!`, "Hi town!"]));
  return "Hi town!";
}

/** Spoken by the giver in a loop ring: "Mini fridge for you, Maya!" */
export function loopLine(item: string, toName: string) {
  const it = item.charAt(0).toUpperCase() + item.slice(1);
  return fit(`${short(it, 18)} for you, ${short(toName, 10)}!`);
}

export function cheer() {
  return pick(["We did it!", "Loop closed!", "Everyone wins!", "Yay!"]);
}

/** Wrap text into at most `maxLines` lines that fit `maxWidth`, ellipsizing the last. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  // Ellipsize anything that still overflows (long words, or leftover text).
  const consumed = lines.join(" ").length;
  for (let i = 0; i < lines.length; i++) {
    const last = i === lines.length - 1;
    let l = lines[i];
    const overflow = ctx.measureText(l).width > maxWidth || (last && consumed < text.length);
    if (!overflow) continue;
    while (l.length > 1 && ctx.measureText(l + "…").width > maxWidth) l = l.slice(0, -1);
    lines[i] = l.trimEnd() + "…";
  }
  return lines;
}
