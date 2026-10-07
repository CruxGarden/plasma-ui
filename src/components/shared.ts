import { useCallback, useState } from "react";
import { useLatest } from "../PlasmaProvider";
import { hexToRgb } from "../moods";

/** Controlled when `value` is given, otherwise it keeps its own state starting at `defaultValue`. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const cb = useLatest(onChange);
  const set = useCallback((v: T) => { if (!controlled) setInner(v); cb.current?.(v); }, [controlled]);
  return [controlled ? value : inner, set];
}

/**
 * Where arrow-key focus goes next in a roving list of `count` items, or -1 for a
 * key that does not move it. Wraps at the ends; Home and End jump to them.
 */
export function rovingIndex(key: string, from: number, count: number, orientation: "horizontal" | "vertical" = "horizontal"): number {
  if (count < 1) return -1;
  const [prev, next] = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === next) return (from + 1) % count;
  if (key === prev) return (from - 1 + count) % count;
  return -1;
}

/** Black or white, whichever reads on a surface tinted `hex` at strength `a`. */
export function inkOn(hex: string, a = 1): string | undefined {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return undefined;
  const [r, g, b] = hexToRgb(hex);
  // Over a dark field the tint only lightens it by `a`; treat the backdrop as mid-dark.
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) * a + 0.12 * (1 - a);
  return L > 0.45 ? "#0b1115" : "#ffffff";
}

/** An id fragment safe in `aria-controls` / `aria-labelledby`, which split on whitespace. */
export const idPart = (v: string) => v.replace(/\s+/g, "_");

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
