import type { Agent } from '@bharat-ai-office/shared';
import { REVIEW_TABLE_POSITION } from '@bharat-ai-office/shared';

// World scale: 1 unit = 1 floor tile = 1 meter, matching the native scale of
// the Kenney Furniture Kit models (desk/wall/floor are all authored at
// real-world meter scale with no rescaling needed — see
// frontend/public/office-3d/props/SOURCE-README.md). Same 30x17 grid the
// old 2D scene used (frontend/components/office-pixel/coords.ts), so
// shared/src/roster.ts's percentage coordinates need no changes.
export const GRID_COLS = 30;
export const GRID_ROWS = 17;

export interface PercentPoint {
  x: number;
  y: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

/** Converts 0-100 percentage coords (agent.home_x/home_y, REVIEW_TABLE_POSITION) into world XZ, centered on the origin so the camera/orbit pivot sits in the middle of the floor. */
export function toWorld(pct: PercentPoint): WorldPoint {
  return {
    x: (pct.x / 100) * GRID_COLS - GRID_COLS / 2,
    z: (pct.y / 100) * GRID_ROWS - GRID_ROWS / 2,
  };
}

export function tileToWorld(col: number, row: number): WorldPoint {
  return { x: col - GRID_COLS / 2 + 0.5, z: row - GRID_ROWS / 2 + 0.5 };
}

export function worldToTile(p: WorldPoint): { col: number; row: number } {
  return {
    col: Math.min(GRID_COLS - 1, Math.max(0, Math.floor(p.x + GRID_COLS / 2))),
    row: Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(p.z + GRID_ROWS / 2))),
  };
}

export const REVIEW_TABLE_WORLD = toWorld(REVIEW_TABLE_POSITION);

// Department -> rug tint under each desk cluster (see OfficeScene3D's
// buildDeskCluster) — pastel accents matching the warm retro palette
// (ASSETS.md), applied as a material color override on a cloned
// rugRectangle.glb instance rather than a separate texture per department.
export const DEPT_RUG_COLOR: Record<string, number> = {
  eng: 0x8ab2a4,
  design: 0xc49e64,
  data: 0x92b478,
  ops: 0xbc828a,
};

// Nova's small enclosed office: side walls on rows 1-3, a wall with a
// 2-tile door gap closing it off at row 4 — same footprint as the old 2D
// layout (pixiScene.ts's NOVA_WALL_* constants).
export const NOVA_WALL_COLS = new Set([11, 20]);
export const NOVA_WALL_ROW = 4;
export const NOVA_WALL_COL_RANGE = { min: 11, max: 20 };
export const NOVA_DOOR_COLS = new Set([15, 16]);

// Windows punched into the back exterior wall (row 0).
export const WINDOW_COLS = new Set([3, 7, 22, 26]);

export type PropKind =
  | 'pottedPlant'
  | 'plantSmall1'
  | 'plantSmall2'
  | 'coffeeStation'
  | 'lampRoundFloor'
  | 'bookshelf';

export interface DecorSpot {
  col: number;
  row: number;
  kind: PropKind;
}

// Fixed set-dressing placed in the aisles/corners the desks don't occupy —
// same spots the 2D scene used, now furnished with real CC0 3D models
// instead of procedural pixel-art tiles (see props/SOURCE-README.md):
// potted plants, a coffee station (sideTable + kitchenCoffeeMachine — the
// "coffee machine" the office needed), a reading-lamp corner, and two
// bookshelves (bookcaseOpen + books).
export const DECOR_SPOTS: DecorSpot[] = [
  { col: 2, row: 2, kind: 'pottedPlant' },
  { col: 27, row: 2, kind: 'plantSmall1' },
  { col: 15, row: 14, kind: 'plantSmall2' },
  { col: 2, row: 8, kind: 'coffeeStation' },
  { col: 27, row: 8, kind: 'lampRoundFloor' },
  { col: 2, row: 13, kind: 'bookshelf' },
  { col: 27, row: 13, kind: 'bookshelf' },
];

export const BREAK_SPOTS: WorldPoint[] = DECOR_SPOTS.map((d) => tileToWorld(d.col, d.row));

/** Department -> which rug color sits under an employee's desk cluster (Nova gets the gold office treatment instead, handled separately). */
export function rugColorFor(agent: Agent): number | null {
  if (agent.id === 'nova') return null;
  return DEPT_RUG_COLOR[agent.dept] ?? null;
}
