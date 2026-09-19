import React, { forwardRef, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { animateSpring, SpringValue, springValue } from "./spring";
import { DEV, useIsoLayoutEffect, useLatest, usePlasmaDefaults, usePlasmaRuntime } from "./PlasmaProvider";
import { JoinedSides, ShapeHandle, ShapeOptions, FORMING_EVENT, FORMED_EVENT } from "./renderer";
import { Box, snapBox } from "./snap";

export interface Offset { x: number; y: number }

/** The props Plasma itself understands. Everything else goes to the rendered element. */
export interface PlasmaOwnProps {
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
  /**
   * Only snap against surfaces carrying the same group. Two independent sets
   * of panels on one page stop latching onto each other. Surfaces with no
   * group form one group of their own. Scopes snapping only - surfaces still
   * fuse visually wherever they overlap.
   */
  group?: string;
  /**
   * Keep dragging inside this element. Defaults to the viewport. Also sets the
   * grid origin. The `| null` matters: under @types/react 19 `useRef<T>(null)`
   * is a `RefObject<T | null>`, which a bare `RefObject<HTMLElement>` rejects.
   */
  bounds?: React.RefObject<HTMLElement | null>;
  /** Controlled offset from the element's layout position. Changes spring into place. */
  offset?: Offset;
  /** Starting offset when uncontrolled. */
  defaultOffset?: Offset;
  onDragStart?: () => void;
  /** Reports the offset the surface is settling into. */
  onDragEnd?: (offset: Offset) => void;
  /** Fires when the surface fuses with or separates from a neighbor. */
  onJoinChange?: (joined: boolean) => void;
  /** This surface forms in, or appears at once; null follows the provider. */
  formIn?: boolean | null;
  /** This surface forms out when removed, or vanishes at once; null follows the provider. */
  formOut?: boolean | null;
  /** Fires as the surface starts forming in (not under reduced motion). The element carries `data-plasma-forming` meanwhile. */
  onForming?: () => void;
  /** Fires once the surface has formed in — at once under reduced motion. Reveal the contents here. */
  onFormed?: () => void;
}

/**
 * Props for `<Plasma as={C}>`: Plasma's own, plus everything `C` accepts.
 * `PlasmaProps` on its own still means the div form, as it always did.
 */
export type PlasmaProps<C extends React.ElementType = "div"> = PlasmaOwnProps & {
  /** Element or component to render. Default "div". */
  as?: C;
  ref?: React.Ref<HTMLElement>;
} & Omit<React.ComponentPropsWithoutRef<C>, keyof PlasmaOwnProps | "as" | "ref">;

const NO_DRAG = "button,a,input,textarea,select,label,[contenteditable],[data-plasma-nodrag]";
const NO_SIDES: JoinedSides = { top: false, right: false, bottom: false, left: false };
const noSides = () => NO_SIDES;

/**
 * The join state arrives from the renderer's frame loop, which is an external
 * store, not React state. Reading it through useSyncExternalStore keeps it
 * tear-free under concurrent rendering, and the subscribe/getSnapshot pair is
 * stable from the first render even though the renderer handle it is fed by
 * only exists after the registration effect.
 */
function createSidesStore() {
  let value = NO_SIDES;
  const subs = new Set<() => void>();
  return {
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    get: () => value,
    set(next: JoinedSides) { value = next; subs.forEach(fn => fn()); },
  };
}

function fallbackTint(hex: string, a: number): React.CSSProperties | null {
  if (!(a > 0) || !/^#([0-9a-f]{6})$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return { backgroundColor: `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${Math.min(a, 1) * 0.85})` };
}

function assignRef<T>(ref: React.ForwardedRef<T>, v: T | null) {
  if (typeof ref === "function") ref(v);
  else if (ref) ref.current = v;
}

/** Lazily create a per-instance value without re-creating it on every render. */
function useConst<T>(make: () => T): T {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = make();
  return ref.current;
}

type PlasmaInnerProps = PlasmaOwnProps & { as?: React.ElementType } & Record<string, unknown>;

const PlasmaInner = forwardRef<HTMLElement, PlasmaInnerProps>(function Plasma(
  {
    as: Comp = "div", radius, lean = 10, tint, opacity, frost, elevation, fuse, padding, draggable = false, snap = true, group, bounds,
    offset, defaultOffset, onDragStart, onDragEnd, onJoinChange, onForming, onFormed, formIn, formOut,
    className, style, children, onPointerDown, onKeyDown, tabIndex, ...rest
  }: PlasmaInnerProps,
  ref,
) {
  const runtime = usePlasmaRuntime();
  const defaults = usePlasmaDefaults();
  const r = radius ?? defaults.radius;
  const el = useRef<HTMLElement | null>(null);
  const handle = useRef<ShapeHandle | null>(null);
  const x = useConst<SpringValue>(() => springValue(offset?.x ?? defaultOffset?.x ?? 0));
  const y = useConst<SpringValue>(() => springValue(offset?.y ?? defaultOffset?.y ?? 0));
  const dest = useRef<Offset>({ x: x.get(), y: y.get() });
  const anims = useRef<{ stop: () => void }[]>([]);
  const [dragging, setDragging] = useState(false);
  const positioned = draggable || !!offset || !!defaultOffset;

  const joinCb = useLatest(onJoinChange);
  const formingCb = useLatest(onForming);
  const formedCb = useLatest(onFormed);
  const sidesStore = useConst(createSidesStore);
  const sides = useSyncExternalStore(sidesStore.subscribe, sidesStore.get, noSides);
  const runtimeRef = useLatest(runtime);
  const defaultsRef = useLatest(defaults);
  const boundsRef = useLatest(bounds);
  const snapRef = useLatest(snap);
  const onDragEndRef = useLatest(onDragEnd);
  const onDragStartRef = useLatest(onDragStart);

  // Registration reads the options through a ref rather than closing over
  // them: the effect only re-runs when the renderer or `positioned` changes,
  // so a prop that moved in between would otherwise draw one stale frame
  // before the update effect below corrected it.
  const opts: ShapeOptions = {
    radius: r, lean: lean || 0, tint: tint ?? null, opacity: opacity ?? null,
    frost: frost ?? null, elevation: elevation ?? null, fuse, group: group ?? null,
    formIn: formIn ?? null, formOut: formOut ?? null,
  };
  const optsRef = useLatest(opts);

  const setRef = useCallback((node: HTMLElement | null) => { el.current = node; assignRef(ref, node); }, [ref]);

  // Register with the renderer.
  useIsoLayoutEffect(() => {
    const node = el.current, ren = runtime.renderer;
    if (!node || !ren) return;
    // The form events come off the element, so they are wired before register fires the first one.
    const onForming = () => formingCb.current?.();
    const onFormed = () => formedCb.current?.();
    node.addEventListener(FORMING_EVENT, onForming);
    node.addEventListener(FORMED_EVENT, onFormed);
    const h = ren.register(node, optsRef.current, j => joinCb.current?.(j), sidesStore.set);
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
    return () => {
      h.remove(); handle.current = null;
      node.removeEventListener(FORMING_EVENT, onForming);
      node.removeEventListener(FORMED_EVENT, onFormed);
    };
  }, [runtime.renderer, positioned]);

  // Layout, not passive: a radius change must reach the renderer in the same
  // commit as the CSS borderRadius it accompanies, or the two disagree for a frame.
  useIsoLayoutEffect(() => {
    handle.current?.update(opts);
  }, [r, lean, tint, opacity, frost, elevation, fuse, group]);

  // Write the offset as a transform (lean and pulse use the separate translate/scale properties).
  useIsoLayoutEffect(() => {
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
    const { spring } = defaultsRef.current;
    if (runtimeRef.current.reducedMotion) { x.set(tx); y.set(ty); anims.current = []; return; }
    const o = { stiffness: spring.stiffness, damping: spring.damping };
    anims.current = [animateSpring(x, tx, { ...o, velocity: vx }), animateSpring(y, ty, { ...o, velocity: vy })];
  }, []);

  // Controlled offset.
  useEffect(() => {
    if (!offset) return;
    if (offset.x === dest.current.x && offset.y === dest.current.y) return;
    springTo(offset.x, offset.y);
  }, [offset?.x, offset?.y]);

  useEffect(() => () => anims.current.forEach(a => a.stop()), []);

  useEffect(() => {
    if (!DEV) return;
    if (!runtime.renderer && runtime.supported) {
      console.warn("[plasma-ui] <Plasma> rendered outside a <PlasmaProvider>: it will draw as the plain CSS fallback.");
    }
    const s = style as React.CSSProperties | undefined;
    if (positioned && s && ("transform" in s || "translate" in s || "scale" in s)) {
      console.warn("[plasma-ui] <Plasma> owns transform, translate and scale on its element. A `style` that sets any of them will fight the drag and lean animations.");
    }
  }, [runtime.renderer, runtime.supported, positioned, style]);

  const boundsBox = useCallback((): Box => {
    const b = boundsRef.current?.current?.getBoundingClientRect();
    return b ? { l: b.left, t: b.top, w: b.width, h: b.height } : { l: 0, t: 0, w: innerWidth, h: innerHeight };
  }, []);

  const settle = useCallback((proposed: Offset, vx = 0, vy = 0) => {
    const node = el.current!, h = handle.current;
    const { grid, magnet } = defaultsRef.current;
    const { renderer } = runtimeRef.current;
    let target = proposed;
    if (snapRef.current && h && renderer) {
      const rect = node.getBoundingClientRect();
      const w = node.offsetWidth, hh = node.offsetHeight;
      const lo = h.leanOffset();
      const baseL = rect.left + (rect.width - w) / 2 - lo.x - x.get();
      const baseT = rect.top + (rect.height - hh) / 2 - lo.y - y.get();
      const s = snapBox(
        { l: baseL + proposed.x, t: baseT + proposed.y, w, h: hh },
        renderer.layoutBoxes(h.id, true, optsRef.current.group ?? null),
        { grid, magnet, bounds: boundsBox(), inset: boundsRef.current ? 0 : 8 },
      );
      target = { x: s.l - baseL, y: s.t - baseT };
    }
    springTo(target.x, target.y, vx, vy);
    onDragEndRef.current?.(target);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    (onPointerDown as ((e: React.PointerEvent<HTMLElement>) => void) | undefined)?.(e);
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
    onDragStartRef.current?.();

    const move = (ev: PointerEvent) => {
      x.set(clamp(start.x + ev.clientX - start.px, minX - 40, maxX + 40));
      y.set(clamp(start.y + ev.clientY - start.py, minY - 40, maxY + 40));
      dest.current = { x: x.get(), y: y.get() };
      runtimeRef.current.bump(Math.hypot(x.getVelocity(), y.getVelocity()) / 1800);
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
  }, [draggable, onPointerDown]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    (onKeyDown as ((e: React.KeyboardEvent<HTMLElement>) => void) | undefined)?.(e);
    if (!draggable || e.defaultPrevented || e.target !== el.current) return;
    const step = defaultsRef.current.grid || 24;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault();
    settle({ x: dest.current.x + d[0], y: dest.current.y + d[1] });
  }, [draggable, onKeyDown]);

  const classes = ["plasma-panel", runtime.supported ? "" : "plasma-fallback", className].filter(Boolean).join(" ");

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
        ...(runtime.supported ? null : fallbackTint(tint ?? defaults.tint, opacity ?? defaults.opacity)),
        ...(style as React.CSSProperties | undefined),
      }}
      data-plasma-draggable={draggable || undefined}
      data-plasma-dragging={dragging || undefined}
      tabIndex={(tabIndex as number | undefined) ?? (draggable ? 0 : undefined)}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children as React.ReactNode}
    </Comp>
  );
});

/**
 * A plasma surface. The DOM stays ordinary HTML; the canvas only draws.
 *
 * The cast is what makes `as` polymorphic: `<Plasma as="a" href=...>` and
 * `<Plasma as={Link} to=...>` typecheck, which a plain forwardRef cannot express.
 */
export const Plasma = PlasmaInner as unknown as <C extends React.ElementType = "div">(
  props: PlasmaProps<C>,
) => React.ReactElement | null;
