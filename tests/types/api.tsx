/**
 * Compile-only checks for the public API. Nothing here runs; `npm run
 * typecheck:app` failing IS the test. It exists because the shapes most
 * likely to break a consumer - polymorphic `as`, refs, and the DOM props that
 * flow through - are invisible to the runtime suite.
 */
import React, { useRef } from "react";
import {
  Plasma, PlasmaProvider, PlasmaCanvas, usePlasma, usePlasmaRuntime, usePlasmaDefaults,
  PlasmaButton, PlasmaSwitch, PlasmaSlider, PlasmaTabs, PlasmaTabList, PlasmaTab, PlasmaTabPanel, PlasmaAccordion, PlasmaAccordionItem,
  type PlasmaProps, type Offset, type PlasmaButtonProps,
} from "../../src";

const Link = (p: { to: string; children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => <a href={p.to}>{p.children}</a>;

export function Api() {
  const boundsDiv = useRef<HTMLDivElement>(null);
  const boundsGeneric = useRef<HTMLElement>(null);
  const panel = useRef<HTMLElement>(null);
  const offset: Offset = { x: 0, y: 0 };

  return (
    <PlasmaProvider
      mood="tidal"
      shimmer={0}
      glow={0}
      wash={0}
      grain={0}
      backgroundBlur={12}
      canvas={false}
    >
      <PlasmaCanvas zIndex={-2} className="bg" style={{ opacity: 0.9 }} />
      <div ref={boundsDiv}>
        {/* default: a div, with div props */}
        <Plasma radius={20} onClick={() => {}} aria-label="panel" ref={panel}>
          plain
        </Plasma>
        {/* a bounds ref typed as the concrete element, and as the base one */}
        <Plasma draggable bounds={boundsDiv} group="left" offset={offset} onDragEnd={(o: Offset) => o.x} />
        <Plasma draggable bounds={boundsGeneric} group="right" />
        {/* polymorphic: an intrinsic element brings its own attributes */}
        <Plasma as="a" href="https://crux.garden" target="_blank" rel="noreferrer">
          link
        </Plasma>
        <Plasma as="button" type="submit" disabled>
          go
        </Plasma>
        {/* polymorphic: a component brings its own props */}
        <Plasma as={Link} to="/somewhere" padding={16}>
          routed
        </Plasma>
      </div>
    </PlasmaProvider>
  );
}

/** The bare name still means the div form, as it did before `as` was generic. */
export const divProps: PlasmaProps = { radius: 12, className: "x", onPointerEnter: () => {} };
export const anchorProps: PlasmaProps<"a"> = { as: "a", href: "#", download: true };

export function Hooks() {
  const all = usePlasma();
  const runtime = usePlasmaRuntime();
  const defaults = usePlasmaDefaults();
  runtime.pulse(0, 0, 1);
  runtime.bump(0.5);
  all.pulse(0, 0);
  return <span>{defaults.radius + all.radius + (runtime.supported ? 1 : 0)}</span>;
}

/** The components: Plasma's own props flow through, and each element's attributes still typecheck. */
export function Components() {
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const buttonProps: PlasmaButtonProps = { solid: true, size: "sm", tint: "#fff", radius: 12, onClick: e => e.currentTarget.blur(), form: "f" };
  return (
    <PlasmaProvider>
      <PlasmaButton ref={btn} {...buttonProps} formAction="/x">go</PlasmaButton>
      <PlasmaSwitch checked onCheckedChange={(c: boolean) => c} label="Wi-Fi" checkedTint="#0f0" name="wifi" />
      <PlasmaSlider ref={box} value={3} onValueChange={(n: number) => n} min={0} max={10} step={0.5} aria-label="Volume" className="s" />
      <PlasmaTabs defaultValue="a" onValueChange={(v: string) => v} orientation="vertical">
        <PlasmaTabList aria-label="t">
          <PlasmaTab value="a" disabled opacity={0.4}>A</PlasmaTab>
        </PlasmaTabList>
        <PlasmaTabPanel value="a" className="p">a</PlasmaTabPanel>
      </PlasmaTabs>
      <PlasmaAccordion type="multiple" value={["a"]} onValueChange={(v: string[]) => v.length}>
        <PlasmaAccordionItem value="a" title={<b>A</b>} headingLevel={4} elevation={0.2} onJoinChange={() => {}}>a</PlasmaAccordionItem>
      </PlasmaAccordion>
    </PlasmaProvider>
  );
}
