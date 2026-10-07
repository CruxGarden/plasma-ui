/**
 * Styles for the components. Colors come from `currentColor`, so they follow
 * the text color the page already sets; nothing here picks a palette.
 * Injected by the provider next to the fallback CSS, so server rendering has
 * them from the first byte.
 */
export const COMPONENT_CSS = `
.plasma-button{font:inherit;color:inherit;border:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:.5em;white-space:nowrap;-webkit-tap-highlight-color:transparent;padding:0 1.25em;height:40px;background:transparent}
.plasma-button[data-size=sm]{height:32px;padding:0 1em;font-size:.875em}
.plasma-button[data-size=lg]{height:48px;padding:0 1.5em;font-size:1.0625em}
.plasma-button:disabled{cursor:not-allowed;opacity:.5}
.plasma-button:focus-visible,.plasma-switch:focus-visible,.plasma-tab:focus-visible,.plasma-accordion-trigger:focus-visible{outline:2px solid currentColor;outline-offset:3px}

.plasma-switch-field{display:inline-flex;align-items:center;gap:.65em;cursor:pointer}
.plasma-switch-field[data-disabled]{cursor:not-allowed;opacity:.6}
.plasma-switch{position:relative;display:inline-block;flex:none;width:46px;height:26px;padding:0;border:0;cursor:pointer;background:transparent}
.plasma-switch:disabled{cursor:not-allowed}
.plasma-switch-knob{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.35);transition:transform .22s cubic-bezier(.3,1.5,.5,1)}
.plasma-switch[aria-checked=true] .plasma-switch-knob{transform:translateX(20px)}

.plasma-slider{position:relative;display:block;height:28px;min-width:120px;box-sizing:border-box}
.plasma-slider[data-disabled]{opacity:.55}
.plasma-slider .plasma-slider-input{position:absolute;inset:0;z-index:1;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.plasma-slider .plasma-slider-input:disabled{cursor:not-allowed}
.plasma-slider-fill{position:absolute;left:4px;top:4px;bottom:4px;border-radius:10px;width:calc(20px + (100% - 28px) * var(--plasma-slider-frac,0));background:color-mix(in srgb,currentColor 28%,transparent);pointer-events:none}
.plasma-slider-thumb{position:absolute;top:4px;left:calc(4px + (100% - 28px) * var(--plasma-slider-frac,0));width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/.35);pointer-events:none}
.plasma-slider-input:focus-visible~.plasma-slider-thumb{outline:2px solid currentColor;outline-offset:3px}

.plasma-tablist{display:inline-flex;gap:0}
.plasma-tabs[data-orientation=vertical] .plasma-tablist{flex-direction:column}
.plasma-tab{font:inherit;color:inherit;border:0;cursor:pointer;padding:.55em 1.1em;background:transparent;white-space:nowrap}
.plasma-tab:disabled{opacity:.5;cursor:not-allowed}
.plasma-tabpanel{margin-top:.75em}
.plasma-tabpanel[hidden]{display:none}
.plasma-tablist>.plasma-fallback:not(:first-child){border-top-left-radius:0!important;border-bottom-left-radius:0!important}
.plasma-tablist>.plasma-fallback:not(:last-child){border-top-right-radius:0!important;border-bottom-right-radius:0!important}
.plasma-tabs[data-orientation=vertical] .plasma-tablist>.plasma-fallback{border-radius:0!important}

.plasma-accordion{display:flex;flex-direction:column}
.plasma-accordion-item+.plasma-accordion-item{box-shadow:inset 0 1px 0 color-mix(in srgb,currentColor 14%,transparent)}
.plasma-accordion-heading{margin:0;font:inherit}
.plasma-accordion-trigger{font:inherit;color:inherit;width:100%;display:flex;align-items:center;justify-content:space-between;gap:1em;text-align:left;padding:.85em 1.25em;border:0;background:transparent;cursor:pointer;border-radius:inherit}
.plasma-accordion-trigger:disabled{opacity:.5;cursor:not-allowed}
.plasma-accordion-chevron{flex:none;width:.55em;height:.55em;border:solid currentColor;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-2px,-2px);transition:transform .25s ease}
.plasma-accordion-item[data-state=open] .plasma-accordion-chevron{transform:rotate(225deg) translate(-2px,-2px)}
.plasma-accordion-body{display:grid;grid-template-rows:0fr;visibility:hidden;transition:grid-template-rows .28s ease,visibility 0s linear .28s}
.plasma-accordion-body[data-state=open]{grid-template-rows:1fr;visibility:visible;transition:grid-template-rows .28s ease}
.plasma-accordion-inner{overflow:hidden;min-height:0}
.plasma-accordion-content{padding:0 1.25em 1em}
.plasma-accordion-item+.plasma-accordion-item.plasma-fallback{border-top-color:transparent}
.plasma-accordion>.plasma-fallback:not(:first-child){border-top-left-radius:0!important;border-top-right-radius:0!important}
.plasma-accordion>.plasma-fallback:not(:last-child){border-bottom-left-radius:0!important;border-bottom-right-radius:0!important}

@media (prefers-reduced-motion:reduce){.plasma-switch-knob,.plasma-accordion-chevron,.plasma-accordion-body,.plasma-accordion-body[data-state=open]{transition:none}}
`;
