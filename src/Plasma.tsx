import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animateSpring, springValue } from "./spring";
import { usePlasma } from "./PlasmaProvider";
import { JoinedSides, ShapeHandle } from "./renderer";
import { Box, snapBox } from "./snap";

export interface Offset { x: number; y: number }

export interface PlasmaProps extends Omit<React.HTMLAttributes<HTMLElement>, "onDragStart" | "onDragEnd"> {
  /** Element to render. Default "div". */
  as?: React.ElementType;
  /** Corner radius in px. Defaults to the provider's radius. */
  radius?: number;
  /** How far (px) the surface leans toward the pointer while standalone. 0 or false disables. Default 10. */
  lean?: number | false;
  /** Tint color (hex) for this surface. Defaults to the provider's tint. */
  tint?: string;
  /** Tint strength, 0 (clear) to 1 (solid color). Defaults to the provider's opacity. */
  opacity?: number;
  /** Translucency, 0 (clear) to 1 (frosted). Defaults to the provider's frost. */
  frost?: number;
  /** Elevation, 0 (flat) to 1 (floating). Defaults to the provider's elevation; raises automatically while dragging. */
  elevation?: number;
  /** When false, this surface never blends, bridges, or joins with others - for bars, docks, and other fixed chrome. Default true. */
  fuse?: boolean;
  /** Inner padding in px. Halves on any edge joined to a neighbor, so gutters between fused panels equal the free-edge inset. */
  padding?: number;
  /** Let the user drag the surface. It moves freely and snaps on release. */
  draggable?: boolean;
  /** Snap on release (edges latch to neighbors, otherwise the grid). Default true. */
  snap?: boolean;
  /** Keep dragging inside this element. Defaults to the viewport. Also sets the grid origin. */
  bounds?: React.RefObject<HTMLElement>;
  /** Controlled offset from the element's layout position. Changes spring into place. */
  offset?: Offset;
  /** Starting offset when uncontrolled. */
  defaultOffset?: Offset;
  onDragStart?: () => void;
  /** Reports the offset the surface is settling into. */
  onDragEnd?: (offset: Offset) => void;
  /** Fires when the surface fuses with or separates from a neighbor. */
  onJoinChange?: (joined: boolean) => void;
}

const NO_DRAG = "button,a,input,textarea,select,label,[contenteditable],[data-plasma-nodrag]";

function fallbackTint(hex: string, a: number): React.CSSProperties | null {
  if (!(a > 0) || !/^#([0-9a-f]{6})$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return { backgroundColor: `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${Math.min(a, 1) * 0.85})` };
}

function assignRef<T>(ref: React.ForwardedRef<T>, v: T | null) {
  if (typeof ref === "function") ref(v);
  else if (ref) ref.current = v;
}

export const Plasma = forwardRef<HTMLElement, PlasmaProps>(function Plasma(
  {
    as: Comp = "div", radius, lean = 10, tint, opacity, frost, elevation, fuse, padding, draggable = false, snap = true, bounds,
    offset, defaultOffset, onDragStart, onDragEnd, onJoinChange,
    className, style, children, onPointerDown, onKeyDown, tabIndex, ...rest
  },
  ref,
) {
  const plasma = usePlasma();
  const r = radius ?? plasma.radius;
  const el = useRef<HTMLElement | null>(null);
  const handle = useRef<ShapeHandle | null>(null);
  const [x] = useState(() => springValue(offset?.x ?? defaultOffset?.x ?? 0));
  const [y] = useState(() => springValue(offset?.y ?? defaultOffset?.y ?? 0));
  const dest = useRef<Offset>({ x: x.get(), y: y.get() });
  const anims = useRef<{ stop: () => void }[]>([]);
  const [dragging, setDragging] = useState(false);
  const positioned = draggable || !!offset || !!defaultOffset;

  const joinCb = useRef(onJoinChange);
  joinCb.current = onJoinChange;
  const [sides, setSides] = useState<JoinedSides>({ top: false, right: false, bottom: false, left: false });
  const plasmaRef = useRef(plasma);
  plasmaRef.current = plasma;

  const setRef = useCallback((node: HTMLElement | null) => { el.current = node; assignRef(ref, node); }, [ref]);

  // Register with the renderer.
  useLayoutEffect(() => {
    const node = el.current, ren = plasma.renderer;
    if (!node || !ren) return;
    const h = ren.register(node, { radius: r, lean: lean || 0, tint: tint ?? null, opacity: opacity ?? null, frost: frost ?? null, elevation: elevation ?? null, fuse }, j => joinCb.current?.(j), setSides);
    if (positioned) {
      h.setLayoutBox(() => {
        const rect = node.getBoundingClientRect();
        const w = node.offsetWidth, hh = node.offsetHeight;
        const lo = h.leanOffset();
        return {
          l: rect.left + (rect.width - w) / 2 - lo.x - x.get() + dest.current.x,
          t: rect.top + (rect.height - hh) / 2 - lo.y - y.get() + dest.current.y,
          w, h: hh,
        };
      });
    }
    handle.current = h;
    return () => { h.remove(); handle.current = null; };
  }, [plasma.renderer, positioned]);

  useEffect(() => {
    handle.current?.update({ radius: r, lean: lean || 0, tint: tint ?? null, opacity: opacity ?? null, frost: frost ?? null, elevation: elevation ?? null, fuse });
  }, [r, lean, tint, opacity, frost, elevation, fuse]);

  // Write the offset as a transform (lean and pulse use the separate translate/scale properties).
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || !positioned) return;
    const apply = () => { node.style.transform = `translate3d(${x.get()}px, ${y.get()}px, 0)`; };
    apply();
    const a = x.on(apply), b = y.on(apply);
    return () => { a(); b(); };
  }, [positioned]);

  const springTo = useCallback((tx: number, ty: number, vx = 0, vy = 0) => {
    dest.current = { x: tx, y: ty };
    anims.current.forEach(a => a.stop());
    const { spring, reducedMotion } = plasmaRef.current;
    if (reducedMotion) { x.set(tx); y.set(ty); anims.current = []; return; }
    const opts = { stiffness: spring.stiffness, damping: spring.damping };
    anims.current = [animateSpring(x, tx, { ...opts, velocity: vx }), animateSpring(y, ty, { ...opts, velocity: vy })];
  }, []);

  // Controlled offset.
  useEffect(() => {
    if (!offset) return;
    if (offset.x === dest.current.x && offset.y === dest.current.y) return;
    springTo(offset.x, offset.y);
  }, [offset?.x, offset?.y]);

  useEffect(() => () => anims.current.forEach(a => a.stop()), []);

  const boundsBox = (): Box => {
    const b = bounds?.current?.getBoundingClientRect();
    return b ? { l: b.left, t: b.top, w: b.width, h: b.height } : { l: 0, t: 0, w: innerWidth, h: innerHeight };
  };

  const settle = (proposed: Offset, vx = 0, vy = 0) => {
    const node = el.current!, h = handle.current;
    const { grid, magnet, renderer } = plasmaRef.current;
    let target = proposed;
    if (snap && h && renderer) {
      const rect = node.getBoundingClientRect();
      const w = node.offsetWidth, hh = node.offsetHeight;
      const lo = h.leanOffset();
      const baseL = rect.left + (rect.width - w) / 2 - lo.x - x.get();
      const baseT = rect.top + (rect.height - hh) / 2 - lo.y - y.get();
      const s = snapBox(
        { l: baseL + proposed.x, t: baseT + proposed.y, w, h: hh },
        renderer.layoutBoxes(h.id, true),
        { grid, magnet, bounds: boundsBox(), inset: bounds ? 0 : 8 },
      );
      target = { x: s.l - baseL, y: s.t - baseT };
    }
    springTo(target.x, target.y, vx, vy);
    onDragEnd?.(target);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    onPointerDown?.(e);
    if (!draggable || e.defaultPrevented || e.button !== 0) return;
    if ((e.target as HTMLElement).closest(NO_DRAG)) return;
    const node = el.current!;
    node.setPointerCapture(e.pointerId);
    anims.current.forEach(a => a.stop());
    const start = { px: e.clientX, py: e.clientY, x: x.get(), y: y.get() };
    // Keep the drag inside bounds (measured once at drag start).
    const bb = boundsBox();
    const rect = node.getBoundingClientRect();
    const lo = handle.current?.leanOffset() ?? { x: 0, y: 0 };
    const baseL = rect.left + (rect.width - node.offsetWidth) / 2 - lo.x - start.x;
    const baseT = rect.top + (rect.height - node.offsetHeight) / 2 - lo.y - start.y;
    const minX = bb.l - baseL, maxX = bb.l + bb.w - node.offsetWidth - baseL;
    const minY = bb.t - baseT, maxY = bb.t + bb.h - node.offsetHeight - baseT;
    const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), Math.max(a, b));

    handle.current?.setDragging(true);
    setDragging(true);
    onDragStart?.();

    const move = (ev: PointerEvent) => {
      x.set(clamp(start.x + ev.clientX - start.px, minX - 40, maxX + 40));
      y.set(clamp(start.y + ev.clientY - start.py, minY - 40, maxY + 40));
      dest.current = { x: x.get(), y: y.get() };
      plasmaRef.current.bump(Math.hypot(x.getVelocity(), y.getVelocity()) / 1800);
    };
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      handle.current?.setDragging(false);
      setDragging(false);
      const vx = x.getVelocity(), vy = y.getVelocity();
      settle({ x: x.get() + vx * 0.15, y: y.get() + vy * 0.15 }, vx, vy);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    if (!draggable || e.defaultPrevented || e.target !== el.current) return;
    const step = plasmaRef.current.grid || 24;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault();
    settle({ x: dest.current.x + d[0], y: dest.current.y + d[1] });
  };

  const classes = ["plasma-glass", plasma.supported ? "" : "plasma-fallback", className].filter(Boolean).join(" ");

  return (
    <Comp
      ref={setRef}
      className={classes}
      style={{
        borderRadius: r,
        ...(padding != null && {
          padding: `${sides.top ? padding / 2 : padding}px ${sides.right ? padding / 2 : padding}px ${sides.bottom ? padding / 2 : padding}px ${sides.left ? padding / 2 : padding}px`,
          transition: "padding 250ms ease",
        }),
        ...(plasma.supported ? null : fallbackTint(tint ?? plasma.tint, opacity ?? plasma.opacity)),
        ...style,
      }}
      data-plasma-draggable={draggable || undefined}
      data-plasma-dragging={dragging || undefined}
      tabIndex={tabIndex ?? (draggable ? 0 : undefined)}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </Comp>
  );
});
