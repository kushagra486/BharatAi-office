// Fixed logical stage size the scene is authored against. Chosen as clean
// multiples of TILE_SIZE (30x17 tiles) while staying close to the 16:9 box
// the old SVG floor used (aspect-[16/9] w-full) — see OfficeFloorPixel.tsx
// for how this gets scaled to fill its container via ResizeObserver.
export const TILE_SIZE = 32;
export const GRID_COLS = 30;
export const GRID_ROWS = 17;
export const STAGE_W = GRID_COLS * TILE_SIZE; // 960
export const STAGE_H = GRID_ROWS * TILE_SIZE; // 544

export interface PercentPoint {
  x: number;
  y: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * Converts the 0-100 percentage coordinates used throughout shared/src/roster.ts
 * (agent.home_x/home_y, REVIEW_TABLE_POSITION) into stage-pixel coordinates.
 * roster.ts stays percentage-based and untouched — this is the one place
 * that knows about the pixel stage.
 */
export function toPixel(pct: PercentPoint): PixelPoint {
  return { x: (pct.x / 100) * STAGE_W, y: (pct.y / 100) * STAGE_H };
}

export function toTile(pct: PercentPoint): { col: number; row: number } {
  const px = toPixel(pct);
  return {
    col: Math.min(GRID_COLS - 1, Math.max(0, Math.floor(px.x / TILE_SIZE))),
    row: Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(px.y / TILE_SIZE))),
  };
}
