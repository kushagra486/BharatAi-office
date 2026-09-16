import { Assets, Graphics, Rectangle, type Renderer, type Spritesheet, Texture } from 'pixi.js';
import { ROSTER } from '@bharat-ai-office/shared';

// The texture-atlas contract every asset source (real hand-drawn art or the
// procedural placeholder below) must satisfy identically. Downstream code
// (CharacterSprite.ts, pixiScene.ts) only ever addresses textures by these
// keys — it never knows or cares which source produced them. See ASSETS.md
// for the authoring spec real art must follow.
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
  /** Shared fallback rig — grayscale, tinted per agent (see CharacterSprite.ts). Used for any agent without an entry in `characterFramesByAgent`. */
  characterFrames: Record<CharacterFrameKey, Texture>;
  /**
   * Full-color per-agent sprite, keyed by roster id (e.g. "kael"). Populated
   * from `/office-pixel/characters/{agentId}.json` — see ASSETS.md "Full-body
   * character sprites". An agent with an entry here is rendered untinted
   * (the sheet is already the real color); an agent without one falls back
   * to the shared grayscale rig + identity tint.
   */
  characterFramesByAgent: Partial<Record<string, Record<CharacterFrameKey, Texture>>>;
  tiles: Record<TileKey, Texture>;
  /** True when the procedural placeholder tileset was used because no real tileset was found. */
  isPlaceholder: boolean;
}

/**
 * Loads the office's visual assets: tries the real authored tileset + shared
 * character rig first, falls back to a procedural placeholder tileset if
 * missing. `renderer` is required for the placeholder path (it rasterizes
 * vector Graphics into textures). Independently loads each agent's distinct
 * sprite sheet — optional and fails silently per agent, so this works
 * whether none, some, or all 11 agents have a custom sheet.
 */
export async function loadOfficeAssets(renderer: Renderer): Promise<OfficeAssets> {
  const [base, characterFramesByAgent] = await Promise.all([tryLoadRealAssets(), loadPerAgentSheets()]);
  const resolved = base ?? buildPlaceholderAssets(renderer);
  return { ...resolved, characterFramesByAgent, isPlaceholder: base === null };
}

async function loadPerAgentSheets(): Promise<Partial<Record<string, Record<CharacterFrameKey, Texture>>>> {
  const result: Partial<Record<string, Record<CharacterFrameKey, Texture>>> = {};
  await Promise.all(
    ROSTER.map(async (agent) => {
      try {
        const sheet = await Assets.load<Spritesheet>(`/office-pixel/characters/${agent.id}.json`);
        result[agent.id] = sheet.textures as unknown as Record<CharacterFrameKey, Texture>;
      } catch {
        // Expected until a custom sheet for this agent is dropped in — not an error.
      }
    })
  );
  return result;
}

type BaseAssets = Omit<OfficeAssets, 'isPlaceholder' | 'characterFramesByAgent'>;

async function tryLoadRealAssets(): Promise<BaseAssets | null> {
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

function buildPlaceholderAssets(renderer: Renderer): BaseAssets {
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
  return { offsetX: 0, offsetY: frame === 0 ? 0 : -1 };
}

function walkPose(frame: WalkFrameIndex): Pose {
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
  // the exact agent color.
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
      g.rect(0, 0, s, s).fill(0x96ad8a);
      break;
    case 'floor_b':
      g.rect(0, 0, s, s).fill(0x8ba37f);
      break;
    case 'wall_edge':
      g.rect(0, 0, s, s).fill(0xebe6d8).rect(0, s - 8, s, 8).fill(0x96ad8a);
      break;
    case 'desk':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(4, 8, s - 8, s - 14, 3).fill(0xc49a5e).stroke({ width: 1, color: 0x5e523e });
      break;
    case 'review_table':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(2, 6, s - 4, s - 10, 4).fill(0x8b5e34).stroke({ width: 1.5, color: 0x7a3b42 });
      break;
    case 'nova_office':
      g.rect(0, 0, s, s).fill(0xeedcb2);
      g.roundRect(4, 6, s - 8, s - 10, 4).fill(0xc49a5e).stroke({ width: 1.5, color: 0xd6a854 });
      break;
    case 'window':
      g.rect(0, 0, s, s).fill(0xebe6d8);
      g.roundRect(3, 3, s - 6, s - 6, 2).fill(0xb0cdd8).stroke({ width: 1, color: 0xc4ba9e });
      g.rect(3, 3, s - 6, 5).fill(0xd6e8ec);
      break;
    case 'wall_inner':
      g.rect(0, 0, s, s).fill(0xebe6d8).rect(0, s / 2 - 2, s, 3).fill(0xc4ba9e);
      break;
    case 'plant':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(s / 2 - 6, s - 12, 12, 9, 2).fill(0x9a6e3e);
      g.circle(s / 2, s - 16, 9).fill(0x608c4e);
      g.circle(s / 2 - 6, s - 12, 6).fill(0x608c4e);
      g.circle(s / 2 + 6, s - 12, 6).fill(0x608c4e);
      break;
    case 'water_cooler':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(s / 2 - 8, s - 16, 16, 12, 2).fill(0xe8e4da).stroke({ width: 1, color: 0xc4ba9e });
      g.roundRect(s / 2 - 6, 6, 12, 14, 3).fill(0x96c4d6);
      break;
    case 'printer':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(4, 8, s - 8, s - 14, 3).fill(0xe8e4da).stroke({ width: 1, color: 0xc4ba9e });
      g.rect(8, s / 2 + 2, s - 16, 3).fill(0x9a6e3e);
      g.circle(10, s / 2 + 3, 1.5).fill(0xdea052);
      break;
    case 'bookshelf':
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(2, 2, s - 4, s - 4, 2).fill(0x9a6e3e);
      g.rect(4, 5, s - 8, s - 10).fill(0xc49a5e);
      for (let i = 0; i < 5; i++) {
        const colors = [0x8cbaac, 0xd6b074, 0xaa9cc4, 0xc89298, 0x92b282];
        g.rect(5 + i * 4, 7, 3, s - 14).fill(colors[i]);
      }
      break;
    case 'rug_eng':
    case 'rug_design':
    case 'rug_data':
    case 'rug_ops': {
      const rugColors: Record<string, [number, number]> = {
        rug_eng: [0xbcd6ce, 0x8ab2a4],
        rug_design: [0xe4d2b0, 0xc49e64],
        rug_data: [0xc4d6b6, 0x92b478],
        rug_ops: [0xe0c2c4, 0xbc828a],
      };
      const [fill, accent] = rugColors[key];
      g.rect(0, 0, s, s).fill(0x96ad8a);
      g.roundRect(1, 1, s - 2, s - 2, 3).fill(fill).stroke({ width: 1.5, color: accent });
      break;
    }
  }
  return g;
}
