/**
 * Motion tokens. Apple's damping/response pair maps onto motion's bounce/duration.
 * Everything defaults to critically damped; bounce is earned only by a fling.
 */

export const spring = {
  /** Default: critically damped, no overshoot. */
  default: { type: "spring", bounce: 0, duration: 0.4 },
  /** Quick UI feedback: chips, pills, small state changes. */
  quick: { type: "spring", bounce: 0, duration: 0.3 },
  /** Only after a drag or fling, always with the release velocity handed off. */
  momentum: { type: "spring", bounce: 0.2, duration: 0.4 },
} as const;

/** Reduced motion: opacity cross-fades, 200ms or less. No translation, scale, particles, hops or camera flights. */
export const reducedFade = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;

export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
};

/** Apple's momentum projection (Designing Fluid Interfaces). velocity in px/s. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp with rubber-banding beyond ±limit. */
export function rubberClamp(v: number, limit: number, dimension = 300) {
  if (Math.abs(v) <= limit) return v;
  const sign = Math.sign(v);
  return sign * (limit + rubberband(Math.abs(v) - limit, dimension));
}

/** Short velocity tracker over pointer samples (px/s). */
export class VelocityTracker {
  private samples: { x: number; y: number; t: number }[] = [];
  push(x: number, y: number, t = performance.now()) {
    this.samples.push({ x, y, t });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  reset() {
    this.samples = [];
  }
  get() {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = Math.max(1, b.t - a.t) / 1000;
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
  }
}
