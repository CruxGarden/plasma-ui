import React, { forwardRef } from "react";
import { Plasma, PlasmaProps } from "../Plasma";
import { usePlasmaDefaults, usePlasmaRuntime } from "../PlasmaProvider";
import { cx, inkOn } from "./shared";

export interface PlasmaButtonOwnProps {
  /** Fill the surface with its tint instead of leaving it clear glass. Default false. */
  solid?: boolean;
  /** Default "md". */
  size?: "sm" | "md" | "lg";
}

export type PlasmaButtonProps = PlasmaButtonOwnProps & Omit<PlasmaProps<"button">, "as" | "ref" | keyof PlasmaButtonOwnProps>;

// Heights are 32 / 40 / 48; the radius is half of that, so the button is a pill.
const SIZES = { sm: 16, md: 20, lg: 24 } as const;

/**
 * A button that is its own plasma surface. Standalone, it leans toward the
 * pointer and sends a pulse through the material when pressed; set next to
 * another surface, it fuses with it like any other.
 */
export const PlasmaButton = forwardRef<HTMLButtonElement, PlasmaButtonProps>(function PlasmaButton(
  { solid = false, size = "md", radius, lean = 6, tint, opacity, type = "button", disabled, className, style, onClick, children, ...rest },
  ref,
) {
  const { pulse, reducedMotion } = usePlasmaRuntime();
  const defaults = usePlasmaDefaults();
  const fill = opacity ?? (solid ? 0.9 : undefined);
  const ink = fill ? inkOn(tint ?? defaults.tint, fill) : undefined;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || reducedMotion) return;
    // detail is 0 for a keyboard "click", where there is no pointer to pulse from.
    const r = e.currentTarget.getBoundingClientRect();
    if (e.detail === 0) pulse(r.left + r.width / 2, r.top + r.height / 2, 0.5);
    else pulse(e.clientX, e.clientY, 0.5);
  };

  return (
    <Plasma
      as="button"
      ref={ref as React.Ref<HTMLElement>}
      type={type}
      disabled={disabled}
      radius={radius ?? SIZES[size]}
      lean={disabled ? false : lean}
      tint={tint}
      opacity={fill}
      className={cx("plasma-button", className)}
      data-size={size}
      style={ink ? { color: ink, ...style } : style}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </Plasma>
  );
});
