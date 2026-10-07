import React, { createContext, forwardRef, useCallback, useContext, useId, useMemo, useRef } from "react";
import { Plasma, PlasmaProps } from "../Plasma";
import { cx, idPart, rovingIndex, useControllable } from "./shared";

interface AccordionContext {
  open: readonly string[];
  toggle: (value: string) => void;
  base: string;
}
const Ctx = createContext<AccordionContext | null>(null);

export interface PlasmaAccordionProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue"> {
  /** "single" keeps one item open at a time; "multiple" lets any number be. Default "single". */
  type?: "single" | "multiple";
  /** The values of the open items (always an array, even for "single"). */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

const NONE: string[] = [];

/**
 * A stack of disclosure panels. The items sit flush, so they fuse into one
 * column of plasma that grows and shrinks as they open. Add a `gap` to the
 * root's style to keep them apart instead.
 */
export const PlasmaAccordion = forwardRef<HTMLDivElement, PlasmaAccordionProps>(function PlasmaAccordion(
  { type = "single", value, defaultValue = NONE, onValueChange, className, onKeyDown, ...rest },
  ref,
) {
  const [open, setOpen] = useControllable(value, defaultValue, onValueChange);
  const base = useId();
  const root = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((n: HTMLDivElement | null) => {
    root.current = n;
    if (typeof ref === "function") ref(n); else if (ref) ref.current = n;
  }, [ref]);

  const toggle = useCallback((v: string) => {
    if (open.includes(v)) setOpen(open.filter(x => x !== v));
    else setOpen(type === "single" ? [v] : [...open, v]);
  }, [open, setOpen, type]);
  const ctx = useMemo(() => ({ open, toggle, base }), [open, toggle, base]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const heads = Array.from(root.current?.querySelectorAll<HTMLElement>(".plasma-accordion-trigger:not(:disabled)") ?? [])
      .filter(head => head.closest('.plasma-accordion') === root.current);
    const from = heads.indexOf(e.target as HTMLElement);
    const to = from < 0 ? -1 : rovingIndex(e.key, from, heads.length, "vertical");
    if (to < 0) return;
    e.preventDefault();
    heads[to].focus();
  };

  return (
    <Ctx.Provider value={ctx}>
      <div ref={setRef} className={cx("plasma-accordion", className)} onKeyDown={handleKeyDown} {...rest} />
    </Ctx.Provider>
  );
});

export interface PlasmaAccordionItemOwnProps {
  /** Identifies the item in the accordion's `value`. */
  value: string;
  /** The always-visible header text. */
  title: React.ReactNode;
  disabled?: boolean;
  /** Which heading element wraps the trigger. Default 3. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}
export type PlasmaAccordionItemProps = PlasmaAccordionItemOwnProps &
  Omit<PlasmaProps<"div">, "as" | "ref" | "title" | keyof PlasmaAccordionItemOwnProps>;

/** One disclosure panel: a plasma surface holding a trigger and its content. */
export const PlasmaAccordionItem = forwardRef<HTMLDivElement, PlasmaAccordionItemProps>(function PlasmaAccordionItem(
  { value, title, disabled, headingLevel = 3, radius = 22, lean = false, className, children, ...rest },
  ref,
) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("[plasma-ui] <PlasmaAccordionItem> must be rendered inside <PlasmaAccordion>.");
  const open = ctx.open.includes(value);
  const part = idPart(value);
  const triggerId = `${ctx.base}-trigger-${part}`;
  const bodyId = `${ctx.base}-body-${part}`;
  const state = open ? "open" : "closed";
  // The closing animation keeps pixels visible briefly; its content must stop
  // accepting focus immediately. Set the DOM property for React 18/19 parity.
  const bodyRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.inert = !open;
  }, [open]);

  return (
    <Plasma
      ref={ref as React.Ref<HTMLElement>}
      radius={radius}
      lean={lean}
      className={cx("plasma-accordion-item", className)}
      data-state={state}
      {...rest}
    >
      {React.createElement(
        `h${headingLevel}`,
        { className: "plasma-accordion-heading" },
        <button
          type="button"
          id={triggerId}
          className="plasma-accordion-trigger"
          aria-expanded={open}
          aria-controls={bodyId}
          disabled={disabled}
          onClick={() => ctx.toggle(value)}
        >
          <span>{title}</span>
          <span className="plasma-accordion-chevron" aria-hidden="true" />
        </button>,
      )}
      <div ref={bodyRef} id={bodyId} role="region" aria-labelledby={triggerId} aria-hidden={!open} className="plasma-accordion-body" data-state={state}>
        <div className="plasma-accordion-inner">
          <div className="plasma-accordion-content">{children}</div>
        </div>
      </div>
    </Plasma>
  );
});
