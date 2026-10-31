import type { Genome } from "./genome";

/**
 * The single source of truth for how a bot looks. Returns SVG markup for a
 * 100×112 viewBox. Bot.tsx renders it in the DOM; canvasBots.ts rasterizes
 * it for the town. Pure vector: gradients, a specular highlight, an inner
 * visor shadow and a contact shadow. No raster images, no filters.
 */

export type BotState = "idle" | "blink" | "walk" | "talk" | "happy" | "wave";
/** Exploration directions kept behind /?admin=1&proto=bots. */
export type BotStyle = "pearl" | "pastel" | "outline";

export interface Pose {
  state: BotState;
  /** Two-frame step for walk, talk and wave. */
  frame?: 0 | 1;
  /** Pupil offset toward a target, each axis in [-1, 1]. */
  look?: { x: number; y: number };
  /** Loop color: tints eyes and visor glow. */
  tint?: string;
  style?: BotStyle;
}

export const BOT_W = 100;
export const BOT_H = 112;

interface HeadGeom {
  head: string;
  visor: { x: number; y: number; w: number; h: number; r: number };
  top: number;
  earY: number;
  earX: [number, number];
}

const HEADS: Record<Genome["shell"], HeadGeom> = {
  pod: {
    head: `<ellipse cx="50" cy="45" rx="34" ry="30"/>`,
    visor: { x: 25, y: 31, w: 50, h: 28, r: 14 },
    top: 15,
    earY: 46,
    earX: [15, 85],
  },
  helmet: {
    head: `<rect x="17" y="15" width="66" height="58" rx="24"/>`,
    visor: { x: 22, y: 30, w: 56, h: 27, r: 12 },
    top: 15,
    earY: 42,
    earX: [17, 83],
  },
  capsule: {
    head: `<rect x="23" y="9" width="54" height="64" rx="27"/>`,
    visor: { x: 28, y: 26, w: 44, h: 30, r: 15 },
    top: 9,
    earY: 42,
    earX: [23, 77],
  },
  dome: {
    head: `<path d="M16 60 A34 34 0 0 1 84 60 L84 63 Q84 73 74 73 L26 73 Q16 73 16 63 Z"/>`,
    visor: { x: 23, y: 36, w: 54, h: 26, r: 13 },
    top: 26,
    earY: 56,
    earX: [16, 84],
  },
};

function shellFill(id: string, g: Genome, style: BotStyle) {
  if (style === "pastel") {
    return `<radialGradient id="${id}s" cx="38%" cy="28%" r="78%">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="${g.accent}"/>
      <stop offset="1" stop-color="${g.accentDeep}"/></radialGradient>`;
  }
  if (style === "outline") {
    return `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E6E9F2"/></linearGradient>`;
  }
  return `<radialGradient id="${id}s" cx="36%" cy="26%" r="80%">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#EEF1F8"/>
    <stop offset=".82" stop-color="#C8CEDF"/><stop offset="1" stop-color="#97A0BA"/></radialGradient>`;
}

function eye(cx: number, cy: number, g: Genome, state: BotState, color: string) {
  if (state === "blink") {
    return `<path d="M${cx - 5} ${cy} H${cx + 5}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (state === "happy") {
    return `<path d="M${cx - 5} ${cy + 2.5} L${cx} ${cy - 3} L${cx + 5} ${cy + 2.5}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const halo = `<circle cx="${cx}" cy="${cy}" r="8" fill="${color}" opacity=".22"/>`;
  if (g.eyes === "arcs") {
    return `${halo}<path d="M${cx - 5} ${cy + 2} Q${cx} ${cy - 5} ${cx + 5} ${cy + 2}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  if (g.eyes === "pixels") {
    return `${halo}<rect x="${cx - 3.5}" y="${cy - 3.5}" width="7" height="7" rx="1.2" fill="${color}"/>`;
  }
  return `${halo}<circle cx="${cx}" cy="${cy}" r="4.6" fill="${color}"/><circle cx="${cx - 1.4}" cy="${cy - 1.6}" r="1.4" fill="#fff" opacity=".9"/>`;
}

export function botMarkup(g: Genome, pose: Pose, uid = "b"): string {
  const style = pose.style ?? "pearl";
  const id = `${uid}-`;
  const { state, frame = 0, look = { x: 0, y: 0 }, tint } = pose;
  const H = HEADS[g.shell];
  const glow = tint ?? g.glow;
  const stroke = style === "outline" ? `stroke="#1B2238" stroke-width="2.5"` : "";
  const hover = g.walk === "hover";
  const lit = state === "happy" || !!tint;

  // Feet and arms
  const step = state === "walk" ? (frame ? -3 : 3) : 0;
  const feet = hover
    ? `<ellipse cx="50" cy="${101 + (state === "walk" ? frame : 0)}" rx="13" ry="3.4" fill="${g.accent}" opacity=".85"/>
       <ellipse cx="50" cy="101" rx="8" ry="2" fill="#fff" opacity=".7"/>`
    : `<ellipse cx="40" cy="${100 + Math.min(0, step)}" rx="8" ry="5" fill="${g.accentDeep}" ${stroke}/>
       <ellipse cx="60" cy="${100 + Math.min(0, -step)}" rx="8" ry="5" fill="${g.accentDeep}" ${stroke}/>`;
  const waveUp = state === "wave";
  const armL = `<rect x="22" y="77" width="9" height="17" rx="4.5" fill="url(#${id}s)" ${stroke} transform="rotate(${state === "walk" ? (frame ? 12 : -8) : 8} 26.5 79)"/>`;
  const armR = waveUp
    ? `<rect x="69" y="62" width="9" height="18" rx="4.5" fill="url(#${id}s)" ${stroke} transform="rotate(${frame ? 28 : 8} 73.5 78)"/>`
    : `<rect x="69" y="77" width="9" height="17" rx="4.5" fill="url(#${id}s)" ${stroke} transform="rotate(${state === "walk" ? (frame ? 8 : -12) : -8} 73.5 79)"/>`;

  // Body: chest plate on capsule, a belly light otherwise
  const body = `<rect x="31" y="70" width="38" height="28" rx="13" fill="url(#${id}s)" ${stroke}/>
    ${g.shell === "capsule"
      ? `<rect x="39" y="77" width="22" height="13" rx="5" fill="${g.accent}"/><circle cx="50" cy="83.5" r="2.6" fill="${glow}"/>`
      : `<circle cx="50" cy="84" r="4" fill="${g.accent}"/><circle cx="48.8" cy="82.8" r="1.2" fill="#fff" opacity=".8"/>`}`;

  // Ears
  const [exL, exR] = H.earX;
  const ears =
    g.ears === "pods"
      ? `<circle cx="${exL}" cy="${H.earY}" r="8" fill="${g.accent}" ${stroke}/><circle cx="${exR}" cy="${H.earY}" r="8" fill="${g.accent}" ${stroke}/>
         <circle cx="${exL - 1.5}" cy="${H.earY - 2.5}" r="2.2" fill="#fff" opacity=".7"/><circle cx="${exR - 1.5}" cy="${H.earY - 2.5}" r="2.2" fill="#fff" opacity=".7"/>`
      : g.ears === "fins"
        ? `<path d="M${exL + 2} ${H.earY - 12} L${exL - 9} ${H.earY - 2} L${exL + 2} ${H.earY + 10} Z" fill="${g.accent}" ${stroke} stroke-linejoin="round"/>
           <path d="M${exR - 2} ${H.earY - 12} L${exR + 9} ${H.earY - 2} L${exR - 2} ${H.earY + 10} Z" fill="${g.accent}" ${stroke} stroke-linejoin="round"/>`
        : g.ears === "bolts"
          ? `<rect x="${exL - 6}" y="${H.earY - 6}" width="8" height="12" rx="3" fill="${g.accentDeep}" ${stroke}/>
             <rect x="${exR - 2}" y="${H.earY - 6}" width="8" height="12" rx="3" fill="${g.accentDeep}" ${stroke}/>`
          : "";

  // Antenna
  const t = H.top;
  const bulb = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${lit ? glow : g.accent}" ${stroke}/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff" opacity=".85"/>`;
  const antenna =
    g.antenna === "bulb"
      ? `<path d="M50 ${t + 2} V${t - 9}" stroke="#AEB6CC" stroke-width="2.6" stroke-linecap="round"/>${bulb(50, t - 12, 4.6)}`
      : g.antenna === "twin"
        ? `<path d="M40 ${t + 4} L35 ${t - 8}" stroke="#AEB6CC" stroke-width="2.4" stroke-linecap="round"/>
           <path d="M60 ${t + 4} L65 ${t - 8}" stroke="#AEB6CC" stroke-width="2.4" stroke-linecap="round"/>
           ${bulb(34, t - 10, 3.6)}${bulb(66, t - 10, 3.6)}`
        : "";

  // Visor
  const v = H.visor;
  const lx = Math.max(-1, Math.min(1, look.x)) * 4;
  const ly = Math.max(-1, Math.min(1, look.y)) * 3;
  const ecy = v.y + v.h * 0.48 + ly;
  const gap = Math.min(10, v.w * 0.2);
  const eyes = eye(50 - gap + lx, ecy, g, state, glow) + eye(50 + gap + lx, ecy, g, state, glow);
  const mouth =
    state === "talk"
      ? `<rect x="${46 + lx * 0.5}" y="${ecy + 7}" width="8" height="${frame ? 5 : 2.6}" rx="1.6" fill="${glow}"/>`
      : state === "happy"
        ? `<path d="M${45 + lx * 0.5} ${ecy + 7} Q${50 + lx * 0.5} ${ecy + 11} ${55 + lx * 0.5} ${ecy + 7}" fill="none" stroke="${glow}" stroke-width="2.4" stroke-linecap="round"/>`
        : "";

  const visor = `
    <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="${v.r}" fill="url(#${id}v)"/>
    <rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="${v.r}" fill="url(#${id}vi)"/>
    ${lit ? `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" rx="${v.r}" fill="${glow}" opacity=".16"/>
             <rect x="${v.x + 0.8}" y="${v.y + 0.8}" width="${v.w - 1.6}" height="${v.h - 1.6}" rx="${v.r - 0.8}" fill="none" stroke="${glow}" stroke-width="1.6" opacity=".9"/>` : ""}
    ${eyes}${mouth}
    <path d="M${v.x + v.r * 0.7} ${v.y + 4.5} Q${v.x + v.w * 0.32} ${v.y + 2.2} ${v.x + v.w * 0.48} ${v.y + 3.6}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".28" fill="none"/>`;

  const highlight =
    style === "outline"
      ? ""
      : `<ellipse cx="${g.shell === "capsule" ? 38 : 34}" cy="${t + 9}" rx="10" ry="4.6" fill="#fff" opacity=".9" transform="rotate(-24 ${g.shell === "capsule" ? 38 : 34} ${t + 9})"/>`;

  const lift = hover ? (state === "walk" ? -4 - frame * 1.5 : -3) : 0;

  return `
  <defs>
    ${shellFill(id, g, style)}
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0A0F1E"/><stop offset="1" stop-color="#1D2747"/>
    </linearGradient>
    <linearGradient id="${id}vi" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".35" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="50" cy="105" rx="${hover ? 17 : 23}" ry="${hover ? 3.4 : 4.4}" fill="#000" opacity="${hover ? 0.22 : 0.34}"/>
  <g transform="translate(0 ${lift})">
    ${feet}${armL}${armR}${body}${ears}${antenna}
    <g fill="url(#${id}s)" ${stroke}>${H.head}</g>
    ${highlight}${visor}
  </g>`;
}

export function botSvgString(g: Genome, pose: Pose, uid = "b") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOT_W} ${BOT_H}" width="${BOT_W}" height="${BOT_H}">${botMarkup(g, pose, uid)}</svg>`;
}
