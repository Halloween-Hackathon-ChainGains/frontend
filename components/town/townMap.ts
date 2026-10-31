/**
 * The town in world coordinates. Origin at the plaza; x right, y down.
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ [Library]        ·  path  ·        [Café]     │
 *   │      ◌    ◌    ╭──── ring ────╮   ◌    ◌      │
 *   │ GATE ═══════════  ( plaza )  ════════════     │
 *   │      ◌    ◌    ╰──────────────╯   ◌    ◌      │
 *   │ [Dorms]          ·  path  ·        [Lab]      │
 *   └───────────────────────────────────────────────┘
 *   ◌ = deal circles where finished loops settle.
 */

export const WORLD = { w: 1600, h: 1000, minX: -800, minY: -500, maxX: 800, maxY: 500 };

export const PLAZA = { x: 0, y: 0, r: 150 };
export const RING = { rx: 470, ry: 300, width: 44 };
export const PATH_W = 44;
export const GATE = { x: -760, y: 0 };
/** Where new bots appear, just inside the gate. */
export const SPAWN = { x: -785, y: 0 };

export interface Building {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
}

export const BUILDINGS: Building[] = [
  { name: "Library", x: -650, y: -400, w: 230, h: 130, roof: "#283660" },
  { name: "Café", x: 650, y: -400, w: 200, h: 120, roof: "#3A2F55" },
  { name: "Dorms", x: -650, y: 400, w: 230, h: 130, roof: "#2B3A5E" },
  { name: "Lab", x: 650, y: 400, w: 210, h: 125, roof: "#24405A" },
];

export const LAMPS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    out.push({ x: Math.cos(t) * (RING.rx + 40), y: Math.sin(t) * (RING.ry + 40) });
  }
  out.push({ x: -330, y: -32 }, { x: 330, y: 32 }, { x: -620, y: 34 }, { x: 620, y: -34 });
  return out;
})();

export const TREES: { x: number; y: number; r: number }[] = [
  { x: -420, y: -440, r: 26 }, { x: -340, y: -455, r: 20 }, { x: 380, y: -450, r: 24 }, { x: 300, y: -440, r: 18 },
  { x: -420, y: 445, r: 24 }, { x: -330, y: 455, r: 18 }, { x: 410, y: 450, r: 26 }, { x: 320, y: 440, r: 20 },
  { x: -760, y: -200, r: 22 }, { x: -760, y: 210, r: 22 }, { x: 760, y: -180, r: 24 }, { x: 765, y: 200, r: 20 },
  { x: -120, y: -460, r: 18 }, { x: 140, y: 465, r: 18 }, { x: -230, y: -150, r: 16 }, { x: 240, y: 150, r: 16 },
];

/** Deal circles: 8 inside the ring road, 10 outside it, all on lawn. */
export const DEAL_CIRCLES: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    out.push({ x: Math.round(Math.cos(t) * 318), y: Math.round(Math.sin(t) * 212) });
  }
  for (const deg of [14, 66, 114, 166, 196, 246, 294, 346, 76, 284]) {
    const t = (deg * Math.PI) / 180;
    out.push({ x: Math.round(Math.cos(t) * 655), y: Math.round(Math.sin(t) * 405) });
  }
  return out;
})();

/** Waypoints along walkable paths for wandering. */
export const WAYPOINTS: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    out.push({ x: Math.cos(t) * RING.rx, y: Math.sin(t) * RING.ry });
  }
  for (let x = -700; x <= 700; x += 100) if (Math.abs(x) > PLAZA.r + 20) out.push({ x, y: 0 });
  for (let y = -440; y <= 440; y += 90) if (Math.abs(y) > PLAZA.r + 20) out.push({ x: 0, y });
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    out.push({ x: Math.cos(t) * (PLAZA.r - 40), y: Math.sin(t) * (PLAZA.r - 40) });
  }
  return out;
})();

export function clampToWorld(x: number, y: number, pad = 24) {
  return {
    x: Math.max(WORLD.minX + pad, Math.min(WORLD.maxX - pad, x)),
    y: Math.max(WORLD.minY + pad, Math.min(WORLD.maxY - pad, y)),
  };
}
