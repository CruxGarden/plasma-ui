import React, { forwardRef } from "react";
import { Plasma, PlasmaProps } from "../Plasma";
import { cx, useControllable } from "./shared";

export interface PlasmaSwitchOwnProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Text beside the switch. Clicking it toggles the switch, and it names the switch for assistive tech. */
  label?: React.ReactNode;
  /** Tint of the track while on. Default a soft green. */
  checkedTint?: string;
}

export type PlasmaSwitchProps = PlasmaSwitchOwnProps &
  Omit<PlasmaProps<"button">, "as" | "ref" | "children" | "onChange" | keyof PlasmaSwitchOwnProps>;

/**
 * An on/off switch. The track is a plasma surface that takes on a tint when
 * on; the knob is plain CSS riding inside it.
 */
export const PlasmaSwitch = forwardRef<HTMLButtonElement, PlasmaSwitchProps>(function PlasmaSwitch(
  { checked, defaultChecked = false, onCheckedChange, label, checkedTint = "#6ee7b7", tint, opacity, radius = 13, lean = 4, disabled, className, onClick, ...rest },
  ref,
) {
  const [on, setOn] = useControllable(checked, defaultChecked, onCheckedChange);

  const track = (
    <Plasma
      as="button"
      ref={ref as React.Ref<HTMLElement>}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      radius={radius}
      lean={disabled ? false : lean}
      tint={on ? checkedTint : tint}
      opacity={on ? 0.75 : opacity}
      className={cx("plasma-switch", className)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOn(!on);
      }}
      {...rest}
    >
      <span className="plasma-switch-knob" aria-hidden="true" />
    </Plasma>
  );
  if (label == null) return track;
  return (
    <label className="plasma-switch-field" data-disabled={disabled || undefined}>
      {track}
      <span>{label}</span>
    </label>
  );
});
