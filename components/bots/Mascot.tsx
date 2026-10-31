"use client";

import { Bot, type BotMood } from "./Bot";
import { MASCOT } from "./genome";

/** The Loop mascot. Always decorative. */
export function Mascot({ size = 40, state = "idle", className }: { size?: number; state?: BotMood; className?: string }) {
  return <Bot genome={MASCOT} size={size} state={state} className={className} />;
}
