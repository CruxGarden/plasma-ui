export { PlasmaProvider, PlasmaCanvas, usePlasma, usePlasmaRuntime, usePlasmaDefaults } from "./PlasmaProvider";
export type { PlasmaProviderProps, PlasmaCanvasProps, PlasmaContextValue, PlasmaRuntime, PlasmaDefaults } from "./PlasmaProvider";
export { Plasma } from "./Plasma";
export type { PlasmaProps, PlasmaOwnProps, Offset } from "./Plasma";
export { moods, resolveMood } from "./moods";
export type { Mood, MoodName } from "./moods";
export { snapBox, boxGap } from "./snap";
export type { Box, SnapOptions } from "./snap";

/**
 * The rendering engine. Exported as an escape hatch - `usePlasmaRuntime()`
 * hands you the live instance - but it is internal: its shape tracks whatever
 * the shaders need and can change in any release, including a patch. Nothing
 * below this line is covered by the package's semver promise.
 * @internal
 */
export { PlasmaRenderer } from "./renderer";
/** @internal */
export { makeShaders, DEFAULT_MAX_SHAPES } from "./shaders";
/** @internal */
export type { BackgroundSource, JoinedSides, RendererSettings, ShapeHandle, ShapeOptions } from "./renderer";
