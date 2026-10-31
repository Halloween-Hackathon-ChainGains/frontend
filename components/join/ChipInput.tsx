"use client";

import { X } from "lucide-react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { project, reducedFade, rubberband, spring, VelocityTracker } from "../motion/springs";
import styles from "./Join.module.css";

const MAX = 5;
const PLACEHOLDERS = ["mini fridge", "January sublet", "calc textbook"];

interface Props {
  id: string;
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  onFocus?: () => void;
  enterKeyHint?: "next" | "done";
  invalid?: boolean;
  errorId?: string;
}

export function ChipInput({ id, label, value, onChange, onFocus, enterKeyHint = "next", invalid, errorId }: Props) {
  const [text, setText] = useState("");
  const [armed, setArmed] = useState(false);
  const [ph, setPh] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const full = value.length >= MAX;

  useEffect(() => {
    const iv = setInterval(() => setPh((p) => (p + 1) % PLACEHOLDERS.length), 2600);
    return () => clearInterval(iv);
  }, []);

  const add = (raw: string) => {
    const item = raw.trim().replace(/\s+/g, " ");
    if (!item || full) return false;
    if (value.some((v) => v.toLowerCase() === item.toLowerCase())) return true;
    onChange([...value, item]);
    return true;
  };

  const remove = (i: number) => {
    onChange(value.filter((_, j) => j !== i));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      // Enter never submits the form.
      e.preventDefault();
      if (add(text)) setText("");
      return;
    }
    if (e.key === "Backspace" && text === "" && value.length) {
      e.preventDefault();
      if (armed) {
        setArmed(false);
        remove(value.length - 1);
      } else setArmed(true);
      return;
    }
    setArmed(false);
  };

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.chipBox} ${invalid ? styles.invalid : ""}`} onClick={() => inputRef.current?.focus()}>
        <ul className={styles.chips} aria-label={`${label} items`}>
          <AnimatePresence initial={false}>
            {value.map((v, i) => (
              <Chip key={v.toLowerCase()} text={v} selected={armed && i === value.length - 1} onRemove={() => remove(i)} />
            ))}
          </AnimatePresence>
        </ul>
        <input
          ref={inputRef}
          id={id}
          className={styles.chipInput}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) {
              v.split(",").slice(0, -1).forEach(add);
              setText(v.split(",").pop() ?? "");
            } else setText(v);
            setArmed(false);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (add(text)) setText("");
            setArmed(false);
          }}
          onFocus={onFocus}
          placeholder={full ? "" : value.length ? "Add another" : PLACEHOLDERS[ph]}
          disabled={false}
          readOnly={full}
          enterKeyHint={enterKeyHint}
          autoComplete="off"
          autoCapitalize="none"
          aria-invalid={invalid || undefined}
          aria-describedby={[`${id}-count`, errorId].filter(Boolean).join(" ")}
        />
      </div>
      <p id={`${id}-count`} className={styles.count} aria-live="polite">
        {full ? "5 of 5" : value.length ? `${value.length} of 5 · Enter to add` : "Type, then press Enter"}
      </p>
    </div>
  );
}

function Chip({ text, selected, onRemove }: { text: string; selected: boolean; onRemove: () => void }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const ref = useRef<HTMLLIElement>(null);
  const drag = useRef<{ startX: number; startY: number; active: boolean; id: number } | null>(null);
  const vt = useRef(new VelocityTracker());

  const onPointerDown = (e: RPointerEvent<HTMLLIElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { startX: e.clientX - x.get(), startY: e.clientY, active: false, id: e.pointerId };
    vt.current.reset();
    x.stop();
  };
  const onPointerMove = (e: RPointerEvent<HTMLLIElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.active) {
      // 10px of hysteresis before committing to a horizontal swipe.
      if (Math.abs(dx) < 10) return;
      if (Math.abs(e.clientY - d.startY) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      d.active = true;
      d.startX += Math.sign(dx) * 10;
      ref.current?.setPointerCapture(e.pointerId);
    }
    const raw = e.clientX - d.startX;
    const w = ref.current?.offsetWidth ?? 120;
    // 1:1 up to the chip's width, rubber-banding beyond.
    x.set(Math.abs(raw) <= w ? raw : Math.sign(raw) * (w + rubberband(Math.abs(raw) - w, w)));
    vt.current.push(e.clientX, 0);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const { vx } = vt.current.get();
    const w = ref.current?.offsetWidth ?? 120;
    const projected = x.get() + project(vx, 0.99);
    if (Math.abs(projected) > w * 0.6) {
      animate(x, Math.sign(projected) * (w + 80), { ...spring.quick, velocity: vx, onComplete: onRemove });
    } else {
      animate(x, 0, { ...spring.momentum, velocity: vx });
    }
  };

  return (
    <motion.li
      ref={ref}
      layout={!reduced}
      className={`${styles.chip} ${selected ? styles.chipSelected : ""}`}
      style={{ x, transformOrigin: "left center" }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: reducedFade }}
      transition={reduced ? reducedFade : spring.quick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className={styles.chipText}>{text}</span>
      <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={`Remove ${text}`}>
        <X size={16} aria-hidden />
      </button>
    </motion.li>
  );
}
