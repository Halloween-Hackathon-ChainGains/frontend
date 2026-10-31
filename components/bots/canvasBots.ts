import { botSvgString, BOT_H, BOT_W, type BotState, type BotStyle } from "./botSvg";
import type { Genome } from "./genome";

/**
 * Sprite cache for the town. Each (seed, state, frame, tint, style, mode) is
 * rasterized once from the bot SVG into an offscreen canvas, so the per-frame
 * cost of drawing a bot is a single drawImage. Facing is applied at draw time
 * with a horizontal flip, which halves the cache without visible difference
 * (the bots are symmetric apart from the pupils, which follow facing anyway).
 */

export type RenderMode = "modern" | "pixel";

interface Key {
  g: Genome;
  state: BotState;
  frame: 0 | 1;
  tint?: string;
  style?: BotStyle;
}

const sprites = new Map<string, HTMLCanvasElement>();
const pending = new Set<string>();
let resolution = 2;
let mode: RenderMode = "modern";
let onReady: (() => void) | null = null;

/** Pixel mode rasterizes at ~24px and upscales nearest-neighbor; modern at world size × DPR × zoom headroom. */
const PIXEL_W = 24;

export function configureSprites(opts: { dpr: number; mode: RenderMode; onReady?: () => void }) {
  const res = Math.min(4, Math.max(1, opts.dpr) * 1.6);
  if (res !== resolution || opts.mode !== mode) {
    sprites.clear();
    pending.clear();
  }
  resolution = res;
  mode = opts.mode;
  onReady = opts.onReady ?? null;
}

const keyOf = (k: Key) => `${k.g.seed}|${k.state}|${k.frame}|${k.tint ?? ""}|${k.style ?? "pearl"}|${mode}|${resolution}`;

/** Returns the cached sprite, or null while it's being rasterized (kicked off on first request). */
export function getSprite(k: Key, worldWidth: number): HTMLCanvasElement | null {
  const key = keyOf(k);
  const hit = sprites.get(key);
  if (hit) return hit;
  if (!pending.has(key) && typeof window !== "undefined") rasterize(key, k, worldWidth);
  return null;
}

function rasterize(key: string, k: Key, worldWidth: number) {
  pending.add(key);
  const svg = botSvgString(k.g, { state: k.state, frame: k.frame, tint: k.tint, style: k.style }, "s");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    pending.delete(key);
    const canvas = document.createElement("canvas");
    if (mode === "pixel") {
      const small = document.createElement("canvas");
      small.width = PIXEL_W;
      small.height = Math.round((PIXEL_W * BOT_H) / BOT_W);
      small.getContext("2d")!.drawImage(img, 0, 0, small.width, small.height);
      const scale = Math.max(2, Math.round((worldWidth * resolution) / PIXEL_W));
      canvas.width = small.width * scale;
      canvas.height = small.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = Math.ceil(worldWidth * resolution);
      canvas.height = Math.ceil((worldWidth * resolution * BOT_H) / BOT_W);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    sprites.set(key, canvas);
    onReady?.();
  };
  img.onerror = () => pending.delete(key);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Warm the common states for a bot so its first frames don't flash empty. */
export function warmSprites(g: Genome, worldWidth: number, style?: BotStyle) {
  for (const state of ["idle", "walk", "blink", "talk"] as const) {
    getSprite({ g, state, frame: 0, style }, worldWidth);
    if (state === "walk" || state === "talk") getSprite({ g, state, frame: 1, style }, worldWidth);
  }
}

export function spriteCount() {
  return sprites.size;
}
