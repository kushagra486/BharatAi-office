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

export type TileKey =
  | 'floor_a'
  | 'floor_b'
  | 'wall_edge'
  | 'wall_inner'
  | 'window'
  | 'desk'
  | 'review_table'
  | 'nova_office'
  | 'plant'
  | 'water_cooler'
  | 'printer'
  | 'bookshelf'
  | 'rug_eng'
  | 'rug_design'
  | 'rug_data'
  | 'rug_ops';

export const FRAME_SIZE = 32; // px — matches TILE_SIZE in coords.ts by convention, not requirement

const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];
const TILE_KEYS: TileKey[] = [
  'floor_a',
  'floor_b',
  'wall_edge',
  'wall_inner',
  'window',
  'desk',
  'review_table',
  'nova_office',
  'plant',
  'water_cooler',
  'printer',
  'bookshelf',
  'rug_eng',
  'rug_design',
  'rug_data',
  'rug_ops',
];

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
      // No stroke — adjacent tiles should blend into one continuous floor
      // rather than reading as a visible grid (see generate-pixel-art.py).
      g.rect(0, 0, s, s).fill(0x141b26);
      break;
    case 'floor_b':
      g.rect(0, 0, s, s).fill(0x121822);
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
    case 'window':
      g.rect(0, 0, s, s).fill(0x0a0e14);
      g.roundRect(3, 3, s - 6, s - 6, 2).fill(0x3f6380).stroke({ width: 1, color: 0x1d2836 });
      g.rect(3, 3, s - 6, 5).fill(0x6ea0be);
      g.rect(s / 2 - 1, 3, 2, s - 6).fill(0x1d2836);
      g.rect(3, s / 2 - 1, s - 6, 2).fill(0x1d2836);
      break;
    case 'wall_inner':
      g.rect(0, 0, s, s).fill(0x0a0e14).rect(0, s / 2 - 2, s, 3).fill(0x1d2836);
      break;
    case 'plant':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(s / 2 - 6, s - 12, 12, 9, 2).fill(0x5e3e28);
      g.circle(s / 2, s - 16, 9).fill(0x4ade80);
      g.circle(s / 2 - 6, s - 12, 6).fill(0x4ade80);
      g.circle(s / 2 + 6, s - 12, 6).fill(0x4ade80);
      break;
    case 'water_cooler':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(s / 2 - 8, s - 16, 16, 12, 2).fill(0x2a3444).stroke({ width: 1, color: 0x1d2836 });
      g.roundRect(s / 2 - 6, 6, 12, 14, 3).fill(0x6ea0be);
      break;
    case 'printer':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(4, 8, s - 8, s - 14, 3).fill(0x2a3444).stroke({ width: 1, color: 0x1d2836 });
      g.rect(8, s / 2 + 2, s - 16, 3).fill(0x0a0e14);
      g.circle(10, s / 2 + 3, 1.5).fill(0xffb454);
      break;
    case 'bookshelf':
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(2, 2, s - 4, s - 4, 2).fill(0x5e3e28);
      g.rect(4, 5, s - 8, s - 10).fill(0x0e141c);
      for (let i = 0; i < 5; i++) {
        const colors = [0x2fe6d2, 0xffb454, 0x8b7cf6, 0xff4d6d, 0x4ade80];
        g.rect(5 + i * 4, 7, 3, s - 14).fill(colors[i]);
      }
      break;
    case 'rug_eng':
    case 'rug_design':
    case 'rug_data':
    case 'rug_ops': {
      const rugColors: Record<string, [number, number]> = {
        rug_eng: [0x102e2c, 0x2fe6d2],
        rug_design: [0x3a2c14, 0xffb454],
        rug_data: [0x14261e, 0x4ade80],
        rug_ops: [0x2e121a, 0xff4d6d],
      };
      const [fill, accent] = rugColors[key];
      g.rect(0, 0, s, s).fill(0x141b26);
      g.roundRect(1, 1, s - 2, s - 2, 3).fill(fill).stroke({ width: 1.5, color: accent });
      break;
    }
  }
  return g;
}
