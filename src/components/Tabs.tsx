import React, { createContext, forwardRef, useCallback, useContext, useId, useMemo, useRef } from "react";
import { Plasma, PlasmaProps } from "../Plasma";
import { cx, idPart, rovingIndex, useControllable } from "./shared";

interface TabsContext {
  value: string;
  select: (value: string) => void;
  orientation: "horizontal" | "vertical";
  base: string;
}
const Ctx = createContext<TabsContext | null>(null);
function useTabs(who: string): TabsContext {
  const c = useContext(Ctx);
  if (!c) throw new Error(`[plasma-ui] <${who}> must be rendered inside <PlasmaTabs>.`);
  return c;
}

export interface PlasmaTabsProps extends Omit<React.ComponentPropsWithoutRef<"div">, "onChange" | "defaultValue"> {
  /** The selected tab's value. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Which way the list runs, and which arrow keys move between tabs. Default "horizontal". */
  orientation?: "horizontal" | "vertical";
}

/**
 * Tabs. The root holds state only; `PlasmaTabList` lays the tabs out flush, so
 * they fuse into one segmented surface, and `PlasmaTab` is each segment.
 */
export const PlasmaTabs = forwardRef<HTMLDivElement, PlasmaTabsProps>(function PlasmaTabs(
  { value, defaultValue, onValueChange, orientation = "horizontal", className, ...rest },
  ref,
) {
  const [current, select] = useControllable(value, defaultValue ?? "", onValueChange);
  const base = useId();
  const ctx = useMemo(() => ({ value: current, select, orientation, base }), [current, select, orientation, base]);
  return (
    <Ctx.Provider value={ctx}>
      <div ref={ref} className={cx("plasma-tabs", className)} data-orientation={orientation} {...rest} />
    </Ctx.Provider>
  );
});

export type PlasmaTabListProps = React.ComponentPropsWithoutRef<"div">;

/** The row (or column) of tabs. Give it an `aria-label`. */
export const PlasmaTabList = forwardRef<HTMLDivElement, PlasmaTabListProps>(function PlasmaTabList(
  { className, onKeyDown, ...rest },
  ref,
) {
  const { orientation } = useTabs("PlasmaTabList");
  const list = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((n: HTMLDivElement | null) => {
    list.current = n;
    if (typeof ref === "function") ref(n); else if (ref) ref.current = n;
  }, [ref]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const tabs = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="tab"]:not(:disabled)') ?? []);
    const to = rovingIndex(e.key, tabs.indexOf(e.target as HTMLElement), tabs.length, orientation);
    if (to < 0 || tabs.indexOf(e.target as HTMLElement) < 0) return;
    e.preventDefault();
    tabs[to].focus();
    tabs[to].click(); // selection follows focus
  };

  return (
    <div
      ref={setRef}
      role="tablist"
      aria-orientation={orientation}
      className={cx("plasma-tablist", className)}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
});

export interface PlasmaTabOwnProps {
  /** Identifies the tab, and the `PlasmaTabPanel` it controls. */
  value: string;
}
export type PlasmaTabProps = PlasmaTabOwnProps & Omit<PlasmaProps<"button">, "as" | "ref" | keyof PlasmaTabOwnProps>;

/** One segment of the tab list. The selected one takes a tint; neighbors fuse around it. */
export const PlasmaTab = forwardRef<HTMLButtonElement, PlasmaTabProps>(function PlasmaTab(
  { value, radius = 18, lean = false, opacity, className, onClick, ...rest },
  ref,
) {
  const t = useTabs("PlasmaTab");
  const selected = t.value === value;
  const part = idPart(value);
  return (
    <Plasma
      as="button"
      ref={ref as React.Ref<HTMLElement>}
      type="button"
      role="tab"
      id={`${t.base}-tab-${part}`}
      aria-selected={selected}
      aria-controls={`${t.base}-panel-${part}`}
      tabIndex={selected ? 0 : -1}
      radius={radius}
      lean={lean}
      opacity={opacity ?? (selected ? 0.3 : undefined)}
      className={cx("plasma-tab", className)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) t.select(value);
      }}
      {...rest}
    />
  );
});

export interface PlasmaTabPanelProps extends React.ComponentPropsWithoutRef<"div"> {
  /** The `value` of the tab that shows this panel. */
  value: string;
}

/** Content for one tab. Only the selected panel's children are mounted. */
export const PlasmaTabPanel = forwardRef<HTMLDivElement, PlasmaTabPanelProps>(function PlasmaTabPanel(
  { value, className, children, ...rest },
  ref,
) {
  const t = useTabs("PlasmaTabPanel");
  const selected = t.value === value;
  const part = idPart(value);
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${t.base}-panel-${part}`}
      aria-labelledby={`${t.base}-tab-${part}`}
      hidden={!selected}
      tabIndex={0}
      className={cx("plasma-tabpanel", className)}
      {...rest}
    >
      {selected ? children : null}
    </div>
  );
});
