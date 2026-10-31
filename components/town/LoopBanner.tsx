"use client";

import { AnimatePresence, motion } from "motion/react";
import { reducedFade, spring } from "../motion/springs";
import styles from "./LoopBanner.module.css";

export interface BannerInfo {
  key: string;
  size: number;
  color: string;
  number: number;
}

/** "Loop found: 4 people" on glass. Materializes (blur + scale + opacity), dismisses itself. */
export function LoopBanner({ banner, reduced }: { banner: BannerInfo | null; reduced: boolean }) {
  return (
    <div className={styles.slot} aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            className={styles.banner}
            style={{ ["--loop" as string]: banner.color }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.96)", filter: "blur(8px)" }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, transform: "scale(1)", filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, transform: "scale(0.98)", filter: "blur(6px)" }}
            transition={reduced ? reducedFade : spring.default}
          >
            <span className={styles.badge}>{banner.number}</span>
            <span>
              Loop found: {banner.size} {banner.size === 1 ? "person" : "people"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
