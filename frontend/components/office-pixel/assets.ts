import { Assets, Graphics, Rectangle, type Renderer, type Spritesheet, Texture } from 'pixi.js';

// The texture-atlas contract every asset source (real hand-drawn art or the
// procedural placeholder below) must satisfy identically. Downstream code
// (CharacterSprite.ts, pixiScene.ts) only ever addresses textures by these
// keys — it never knows or cares which source produced them. This is what
// makes "drop in real art later" a zero-code-change asset swap: see
// ASSETS.md for the authoring spec real art must follow.
export type Direction = 'down' | 'up' | 'left' | 'right';
export type IdleFrameIndex = 0 | 1;
export type WalkFrameIndex = 0 | 1 | 2 | 3;

export type CharacterFrameKey = `idle_${Direction}_${IdleFrameIndex}` | `walk_${Direction}_${WalkFrameIndex}`;

export type TileKey = 'floor_a' | 'floor_b' | 'wall_edge' | 'desk' | 'review_table' | 'nova_office';

export const FRAME_SIZE = 32; // px — matches TILE_SIZE in coords.ts by convention, not requirement

const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];
const TILE_KEYS: TileKey[] = ['floor_a', 'floor_b', 'wall_edge', 'desk', 'review_table', 'nova_office'];

export interface OfficeAssets {
  characterFrames: Record<CharacterFrameKey, Texture>;
  tiles: Record<TileKey, Texture>;
  /** True when the procedural placeholder was used because no real sheet was found. */
  isPlaceholder: boolean;
}

/**
 * Loads the office's visual assets: tries a real authored sprite sheet +
 * tileset first, falls back to generating a placeholder that satisfies the
 * exact same CharacterFrameKey/TileKey contract. `renderer` is required for
 * the placeholder path (it rasterizes vector Graphics into textures).
 */
export async function loadOfficeAssets(renderer: Renderer): Promise<OfficeAssets> {
  const real = await tryLoadRealAssets();
  if (real) return { ...real, isPlaceholder: false };
  return { ...buildPlaceholderAssets(renderer), isPlaceholder: true };
}

async function tryLoadRealAssets(): Promise<Omit<OfficeAssets, 'isPlaceholder'> | null> {
  try {
    const [characters, tileset] = await Promise.all([
      Assets.load<Spritesheet>('/office-pixel/characters.json'),
      Assets.load<Spritesheet>('/office-pixel/tileset.json'),
    ]);
    return {
      characterFrames: characters.textures as unknown as Record<CharacterFrameKey, Texture>,
      tiles: tileset.textures as unknown as Record<TileKey, Texture>,
    };
  } catch {
    // Expected until real art matching ASSETS.md is dropped into
    // frontend/public/office-pixel/ — not an error, just "no art yet".
    return null;
  }
}

// --- placeholder generation --------------------------------------------------
//
// Draws simple tinted vector shapes and rasterizes them into textures under
// the exact same keys real art will use, so the full rendering pipeline
// (AnimatedSprite frame-swapping, direction changes, tint-per-agent) is
// exercised identically regardless of asset source. This is intentionally
// not meant to look like finished pixel art — see ASSETS.md.

function buildPlaceholderAssets(renderer: Renderer): Omit<OfficeAssets, 'isPlaceholder'> {
  const characterFrames = {} as Record<CharacterFrameKey, Texture>;

  for (const direction of DIRECTIONS) {
    for (const frame of [0, 1] as IdleFrameIndex[]) {
      characterFrames[`idle_${direction}_${frame}`] = rasterize(renderer, drawBody(direction, idlePose(frame)));
    }
    for (const frame of [0, 1, 2, 3] as WalkFrameIndex[]) {
      characterFrames[`walk_${direction}_${frame}`] = rasterize(renderer, drawBody(direction, walkPose(frame)));
    }
  }

  const tiles = {} as Record<TileKey, Texture>;
  for (const key of TILE_KEYS) {
    tiles[key] = rasterize(renderer, drawTile(key));
  }

  return { characterFrames, tiles };
}

const FRAME_RECT = new Rectangle(0, 0, FRAME_SIZE, FRAME_SIZE);

function rasterize(renderer: Renderer, graphics: Graphics): Texture {
  return renderer.generateTexture({
    target: graphics,
    frame: FRAME_RECT,
    textureSourceOptions: { scaleMode: 'nearest' },
  });
}

interface Pose {
  offsetX: number;
  offsetY: number;
}

function idlePose(frame: IdleFrameIndex): Pose {
  // Idle bob baked into the frames themselves (replacing the old CSS
  // animate-idle-bob keyframe) — a 1px vertical oscillation read through
  // AnimatedSprite's normal loop, matching how real pixel-art idle cycles
  // are authored.
  return { offsetX: 0, offsetY: frame === 0 ? 0 : -1 };
}

function walkPose(frame: WalkFrameIndex): Pose {
  // A small horizontal wobble to read as motion; real art replaces this
  // with an actual leg-cycle animation.
  const offsets: Pose[] = [{ offsetX: -1, offsetY: 0 }, { offsetX: 0, offsetY: -1 }, { offsetX: 1, offsetY: 0 }, { offsetX: 0, offsetY: -1 }];
  return offsets[frame];
}

function drawBody(direction: Direction, pose: Pose): Graphics {
  const g = new Graphics();
  const cx = FRAME_SIZE / 2 + pose.offsetX;
  const cy = FRAME_SIZE / 2 + pose.offsetY;
  const w = 18;
  const h = 22;

  // Body — drawn in white so per-agent `.tint` (CharacterSprite.ts) renders
  // the exact agent color, same as the old SVG's fill={color}.
  g.roundRect(cx - w / 2, cy - h / 2, w, h, 6).fill(0xffffff);

  // Facing indicator — a small notch on whichever edge faces `direction`,
  // the only thing that makes direction legible without real art.
  const nub = 5;
  const notch: Record<Direction, [number, number]> = {
    down: [cx, cy + h / 2 - 2],
    up: [cx, cy - h / 2 + 2],
    left: [cx - w / 2 + 2, cy],
    right: [cx + w / 2 - 2, cy],
  };
  const [nx, ny] = notch[direction];
  g.circle(nx, ny, nub / 2).fill(0xffffff);

  return g;
}

function drawTile(key: TileKey): Graphics {
  const g = new Graphics();
  const s = FRAME_SIZE;
  switch (key) {
    case 'floor_a':
      g.rect(0, 0, s, s).fill(0x141b26).stroke({ width: 1, color: 0x1d2836 });
      break;
    case 'floor_b':
      g.rect(0, 0, s, s).fill(0x121822).stroke({ width: 1, color: 0x1d2836 });
      break;
    case 'wall_edge':
      g.rect(0, 0, s, s).fill(0x0a0e14).rect(0, 0, s, 6).fill(0x1d2836);
      break;
    case 'desk':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(4, 8, s - 8, s - 14, 3).fill(0x2a3444).stroke({ width: 1, color: 0x1d2836 });
      break;
    case 'review_table':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(2, 6, s - 4, s - 10, 4).fill(0x3a2c14).stroke({ width: 1.5, color: 0xffb454 });
      break;
    case 'nova_office':
      g.rect(0, 0, s, s).fill(0x1a1530);
      g.roundRect(4, 6, s - 8, s - 10, 4).fill(0x2c2450).stroke({ width: 1.5, color: 0x8b7cf6 });
      break;
  }
  return g;
}
