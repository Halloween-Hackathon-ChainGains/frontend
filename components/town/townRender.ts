import { BUILDINGS, DEAL_CIRCLES, GATE, LAMPS, PATH_W, PLAZA, RING, TREES, WORLD } from "./townMap";
import type { RenderMode } from "../bots/canvasBots";

/** Town palette: low-key so bots, bubbles and loop colors carry the contrast. */
export const TOWN = {
  ground: "#101A33",
  lawn: "#122042",
  path: "#18233F",
  pathEdge: "#1E2A4A",
  plaza: "#1F2C4C",
  plazaLine: "#2A3961",
  building: "#1A2440",
  window: "#FFC478",
  lamp: "#FFE2B0",
  lampGlow: "255,196,120",
  tree: "#163444",
  treeHi: "#1D4253",
  pad: "#16244A",
  padLine: "#2A3A66",
  label: "#6F7B97",
};

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`;
const TILE = 16;

/**
 * Pre-render the static town once into an offscreen canvas in world space.
 * Re-run only on DPR change or render-mode change, never per frame.
 */
export function renderTown(scale: number, mode: RenderMode): HTMLCanvasElement {
  const full = document.createElement("canvas");
  full.width = Math.ceil(WORLD.w * scale);
  full.height = Math.ceil(WORLD.h * scale);
  const ctx = full.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, -WORLD.minX * scale, -WORLD.minY * scale);
  drawWorld(ctx, mode);

  if (mode === "modern") return full;

  // Pixel: redraw the same layout snapped to a 16px tile grid with nearest-neighbor upscale.
  const small = document.createElement("canvas");
  small.width = WORLD.w / TILE * 2;
  small.height = WORLD.h / TILE * 2;
  const sctx = small.getContext("2d")!;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(full, 0, 0, small.width, small.height);
  const out = document.createElement("canvas");
  out.width = full.width;
  out.height = full.height;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, out.width, out.height);
  // Re-draw building labels crisply on top; text never pixelates.
  octx.setTransform(scale, 0, 0, scale, -WORLD.minX * scale, -WORLD.minY * scale);
  drawLabels(octx);
  return out;
}

function drawWorld(ctx: CanvasRenderingContext2D, mode: RenderMode) {
  const { minX, minY, w, h } = WORLD;

  // Ground with a soft centre lift so the plaza reads as the heart of town.
  ctx.fillStyle = TOWN.ground;
  ctx.fillRect(minX, minY, w, h);
  const lift = ctx.createRadialGradient(0, 0, 80, 0, 0, 780);
  lift.addColorStop(0, "rgba(40,60,110,0.22)");
  lift.addColorStop(1, "rgba(40,60,110,0)");
  ctx.fillStyle = lift;
  ctx.fillRect(minX, minY, w, h);

  // Lawns between ring and edge.
  ctx.fillStyle = TOWN.lawn;
  roundRect(ctx, minX + 30, minY + 30, w - 60, h - 60, 80);
  ctx.fill();

  // Lamp light pools under the paths.
  for (const l of LAMPS) {
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 130);
    g.addColorStop(0, `rgba(${TOWN.lampGlow},0.16)`);
    g.addColorStop(1, `rgba(${TOWN.lampGlow},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 130, l.y - 130, 260, 260);
  }

  // Paths: edge stroke, then fill stroke.
  const paths = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(0, 0, RING.rx, RING.ry, 0, 0, Math.PI * 2);
    ctx.moveTo(GATE.x - 30, 0);
    ctx.lineTo(WORLD.maxX - 60, 0);
    ctx.moveTo(0, WORLD.minY + 60);
    ctx.lineTo(0, WORLD.maxY - 60);
    for (const b of BUILDINGS) {
      ctx.moveTo(b.x * 0.62, b.y * 0.66);
      ctx.lineTo(b.x - Math.sign(b.x) * 30, b.y - Math.sign(b.y) * (b.h / 2 - 8));
    }
    ctx.stroke();
  };
  paths(PATH_W + 6, TOWN.pathEdge);
  paths(PATH_W, TOWN.path);

  // Plaza.
  ctx.fillStyle = TOWN.pathEdge;
  circle(ctx, 0, 0, PLAZA.r + 6);
  ctx.fill();
  ctx.fillStyle = TOWN.plaza;
  circle(ctx, 0, 0, PLAZA.r);
  ctx.fill();
  ctx.strokeStyle = TOWN.plazaLine;
  ctx.lineWidth = 2;
  for (const r of [PLAZA.r - 22, PLAZA.r - 58]) {
    circle(ctx, 0, 0, r);
    ctx.stroke();
  }
  // A faint loop emblem in the plaza stones: three arrows chasing round.
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(120,140,200,0.16)";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(0, 0, 40, a + 0.25, a + 1.75);
    ctx.stroke();
  }

  // Deal circle pads.
  for (const d of DEAL_CIRCLES) {
    ctx.fillStyle = TOWN.pad;
    circle(ctx, d.x, d.y, 50);
    ctx.fill();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = TOWN.padLine;
    ctx.lineWidth = 2;
    circle(ctx, d.x, d.y, 50);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Buildings.
  for (const b of BUILDINGS) {
    const x = b.x - b.w / 2;
    const y = b.y - b.h / 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, x + 6, y + 10, b.w, b.h, 14);
    ctx.fill();
    ctx.fillStyle = TOWN.building;
    roundRect(ctx, x, y, b.w, b.h, 14);
    ctx.fill();
    ctx.fillStyle = b.roof;
    roundRect(ctx, x, y, b.w, b.h * 0.42, 14);
    ctx.fill();
    // Lit windows, deterministic pattern.
    const cols = Math.floor(b.w / 34);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 2; r++) {
        const on = (c * 7 + r * 3 + b.name.length) % 3 !== 0;
        ctx.fillStyle = on ? TOWN.window : "#222E50";
        ctx.globalAlpha = on ? 0.75 : 1;
        roundRect(ctx, x + 16 + c * 34, y + b.h * 0.52 + r * 26, 18, 14, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Trees: rounded canopies with a top-left highlight.
  for (const t of TREES) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + t.r * 0.7, t.r * 0.9, t.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TOWN.tree;
    circle(ctx, t.x, t.y, t.r);
    ctx.fill();
    ctx.fillStyle = TOWN.treeHi;
    circle(ctx, t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55);
    ctx.fill();
  }

  // Lamps.
  for (const l of LAMPS) {
    ctx.fillStyle = "#2A3558";
    circle(ctx, l.x, l.y, 6);
    ctx.fill();
    ctx.fillStyle = TOWN.lamp;
    circle(ctx, l.x, l.y, 3.5);
    ctx.fill();
  }

  // Gate arch.
  ctx.fillStyle = "#2B3862";
  roundRect(ctx, GATE.x - 8, -64, 16, 40, 4);
  ctx.fill();
  roundRect(ctx, GATE.x - 8, 24, 16, 40, 4);
  ctx.fill();
  ctx.strokeStyle = "#3A4A7C";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(GATE.x, -60);
  ctx.quadraticCurveTo(GATE.x - 26, 0, GATE.x, 60);
  ctx.stroke();

  if (mode === "modern") drawLabels(ctx);
}

function drawLabels(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = TOWN.label;
  ctx.font = `600 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of BUILDINGS) ctx.fillText(b.name, b.x, b.y - b.h * 0.21);
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText("Gate", GATE.x + 2, -80);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
