import { mulberry32 } from "../data/fixtures";
import { normalizeName } from "../data/adapt";

export type Shell = "pod" | "helmet" | "capsule" | "dome";
export type Antenna = "none" | "bulb" | "twin";
export type Ears = "pods" | "fins" | "bolts" | "none";
export type Eyes = "dots" | "arcs" | "pixels";
export type Walk = "waddle" | "hover" | "hop";

export interface Genome {
  seed: string;
  shell: Shell;
  accent: string;
  accentDeep: string;
  glow: string;
  antenna: Antenna;
  ears: Ears;
  eyes: Eyes;
  walk: Walk;
  /** Multiplier on base walk speed, 0.85–1.15. */
  speed: number;
}

/** Pastel accents with a deeper partner for shading. */
const ACCENTS: [string, string][] = [
  ["#A8F0D6", "#5FC9A6"], // mint
  ["#CDBFFF", "#9886EA"], // lilac
  ["#FFCBA8", "#E8946A"], // peach
  ["#AEDBFF", "#6AA9E6"], // sky
  ["#FFE7A0", "#E3BC4D"], // butter
  ["#FFBCD6", "#E57FA6"], // rose
  ["#C6F2A6", "#86C95C"], // lime
  ["#B9F0F5", "#69C4CF"], // aqua
];

const GLOWS = ["#7FF3FF", "#9DFFC4", "#FFE28A", "#FFB3EC", "#B5C7FF"];

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

const cache = new Map<string, Genome>();

/** Deterministic traits from the person's normalized name. */
export function genomeFor(name: string): Genome {
  const seed = normalizeName(name) || "loop";
  const hit = cache.get(seed);
  if (hit) return hit;
  const r = mulberry32(hashString(seed));
  const shell = pick(r, ["pod", "helmet", "capsule", "dome"] as const);
  const [accent, accentDeep] = pick(r, ACCENTS);
  const g: Genome = {
    seed,
    shell,
    accent,
    accentDeep,
    glow: pick(r, GLOWS),
    antenna: shell === "dome" ? "twin" : pick(r, ["none", "bulb", "bulb", "twin"] as const),
    ears: shell === "pod" ? "pods" : shell === "helmet" ? "fins" : pick(r, ["bolts", "none", "pods"] as const),
    eyes: pick(r, ["dots", "dots", "arcs", "pixels"] as const),
    walk: pick(r, ["waddle", "waddle", "hover", "hop"] as const),
    speed: 0.85 + r() * 0.3,
  };
  cache.set(seed, g);
  return g;
}

/** The Loop mascot: a fixed genome so it never changes. */
export const MASCOT: Genome = {
  seed: "__loop__",
  shell: "pod",
  accent: "#AEDBFF",
  accentDeep: "#6AA9E6",
  glow: "#7FF3FF",
  antenna: "bulb",
  ears: "pods",
  eyes: "dots",
  walk: "waddle",
  speed: 1,
};
