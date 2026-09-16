// Agent identity color -> hex, for DOM/CSS contexts (roster list, side panel).
// Same palette as CharacterSprite.ts's TOKEN_TINT (Pixi numeric hex) and the
// legacy WalkerAvatar.tsx's TOKEN_HEX — kept as a separate small map rather
// than importing across those (one's Pixi-numeric, the other is dead SVG
// code) since this project already accepts one map per consumer type.
export const AGENT_COLOR_HEX: Record<string, string> = {
  '--violet': '#8B7CF6',
  '--red': '#FF4D4D',
  '--orange': '#FF9433',
  '--gold': '#FFD23F',
  '--lime': '#A8E62E',
  '--emerald': '#2ECC71',
  '--cyan': '#2FE6D2',
  '--sky': '#38BDF8',
  '--blue': '#5B7FFF',
  '--pink': '#FF4FC3',
  '--rose': '#FF4D79',
};

export function agentColorHex(colorToken: string): string {
  return AGENT_COLOR_HEX[colorToken] ?? AGENT_COLOR_HEX['--cyan'];
}
