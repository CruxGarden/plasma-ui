import React, { forwardRef } from "react";
import { Plasma, PlasmaProps } from "../Plasma";
import { cx, useControllable } from "./shared";

export interface PlasmaSliderOwnProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Default 0. */
  min?: number;
  /** Default 100. */
  max?: number;
  /** Default 1. */
  step?: number;
  disabled?: boolean;
  /** Form field name for the underlying range input. */
  name?: string;
  /** Give the slider an accessible name; these, and `id`, go to the range input rather than the surface. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-valuetext"?: string;
}

export type PlasmaSliderProps = PlasmaSliderOwnProps &
  Omit<PlasmaProps<"div">, "as" | "ref" | "children" | "onChange" | keyof PlasmaSliderOwnProps>;

/**
 * A slider. The track is a plasma surface; underneath the visuals is a native
 * `<input type="range">`, so keyboard, touch, and form behavior are the browser's own.
 */
export const PlasmaSlider = forwardRef<HTMLDivElement, PlasmaSliderProps>(function PlasmaSlider(
  {
    value, defaultValue, onValueChange, min = 0, max = 100, step = 1, disabled, name, id,
    "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, "aria-valuetext": ariaValueText,
    radius = 14, lean = false, className, style, ...rest
  },
  ref,
) {
  const [v, setV] = useControllable(value, defaultValue ?? min, onValueChange);
  // Match native range sanitization so the painted thumb and input agree.
  const upper = Math.max(min, max);
  const increment = step > 0 && Number.isFinite(step) ? step : 1;
  const clamped = Math.max(min, Math.min(upper, Number.isFinite(v) ? v : (min + upper) / 2));
  const steps = Math.min(Math.round((clamped - min) / increment), Math.floor((upper - min) / increment + 1e-10));
  const normalized = Number((min + steps * increment).toPrecision(15));
  const span = max - min;
  const frac = span > 0 ? Math.min(Math.max((normalized - min) / span, 0), 1) : 0;

  return (
    <Plasma
      ref={ref as React.Ref<HTMLElement>}
      radius={radius}
      lean={disabled ? false : lean}
      className={cx("plasma-slider", className)}
      data-disabled={disabled || undefined}
      style={{ ["--plasma-slider-frac" as string]: frac, ...style }}
      {...rest}
    >
      {/* First, so the thumb can be styled from its :focus-visible with a sibling selector. */}
      <input
        className="plasma-slider-input"
        type="range"
        id={id}
        name={name}
        min={min}
        max={max}
        step={step}
        value={normalized}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={ariaValueText}
        onChange={e => setV(e.currentTarget.valueAsNumber)}
      />
      <span className="plasma-slider-fill" aria-hidden="true" />
      <span className="plasma-slider-thumb" aria-hidden="true" />
    </Plasma>
  );
});
