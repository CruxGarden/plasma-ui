export interface Mood {
  /** Background colors: deep base, mid tone, accent. Hex strings. */
  colors: [string, string, string];
  /** How far apart (px) surfaces start to fuse. */
  blend: number;
  /** Spring used for drag release, snapping, and controlled offsets. */
  spring: { stiffness: number; damping: number };
}

export const moods = {
  tidal:  { colors: ["#04111c", "#0f4c5c", "#6a5acd"], blend: 40, spring: { stiffness: 170, damping: 16 } },
  aurora: { colors: ["#050b12", "#0f5e46", "#b04bd6"], blend: 40, spring: { stiffness: 120, damping: 11 } },
  ember:  { colors: ["#12060a", "#6b1a2a", "#e39a3b"], blend: 40, spring: { stiffness: 260, damping: 20 } },
} satisfies Record<string, Mood>;

export type MoodName = keyof typeof moods;

export function resolveMood(mood: MoodName | Mood): Mood {
  return typeof mood === "string" ? moods[mood] ?? moods.tidal : mood;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
}
