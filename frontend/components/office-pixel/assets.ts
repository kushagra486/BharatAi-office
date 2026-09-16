import { Assets, Graphics, Rectangle, type Renderer, type Spritesheet, Texture } from 'pixi.js';
import { ROSTER } from '@bharat-ai-office/shared';

// The texture-atlas contract the tileset (real hand-drawn art or the
// procedural placeholder below) must satisfy identically. Downstream code
// (pixiScene.ts) only ever addresses tile textures by these keys — it never
// knows or cares which source produced them. Agents themselves are rendered
// from their real portrait photos (see loadPortraitTextures below and
// CharacterSprite.ts) — there is no procedural character rig.
export type Direction = 'down' | 'up' | 'left' | 'right';

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
  /**
   * Real profile photos, keyed by roster id, loaded from
   * `/office-pixel/portraits/{agentId}.png` (the same files AgentAvatar.tsx
   * uses in the roster/side panel). CharacterSprite.ts renders every agent
   * as a circular photo token on the floor using these — see ASSETS.md.
   */
  portraitTextures: Partial<Record<string, Texture>>;
  tiles: Record<TileKey, Texture>;
  /** True when the procedural placeholder tileset was used because no real tileset was found. */
  isPlaceholder: boolean;
}

/**
 * Loads the office's visual assets: tries a real authored tileset first,
 * falls back to generating a placeholder that satisfies the exact same
 * TileKey contract. `renderer` is required for the placeholder path (it
 * rasterizes vector Graphics into textures). Independently loads each
 * agent's portrait photo — optional and fails silently per agent, so this
 * works whether none, some, or all 11 agents have a portrait dropped in.
 */
export async function loadOfficeAssets(renderer: Renderer): Promise<OfficeAssets> {
  const [tiles, portraitTextures] = await Promise.all([tryLoadTileset(), loadPortraitTextures()]);
  return {
    tiles: tiles ?? buildPlaceholderTiles(renderer),
    portraitTextures,
    isPlaceholder: tiles === null,
  };
}

async function loadPortraitTextures(): Promise<Partial<Record<string, Texture>>> {
  const result: Partial<Record<string, Texture>> = {};
  await Promise.all(
    ROSTER.map(async (agent) => {
      try {
        result[agent.id] = await Assets.load<Texture>(`/office-pixel/portraits/${agent.id}.png`);
      } catch {
        // Expected until a portrait for this agent is dropped in — not an error.
      }
    })
  );
  return result;
}

async function tryLoadTileset(): Promise<Record<TileKey, Texture> | null> {
  try {
    const tileset = await Assets.load<Spritesheet>('/office-pixel/tileset.json');
    return tileset.textures as unknown as Record<TileKey, Texture>;
  } catch {
    // Expected until real art matching ASSETS.md is dropped into
    // frontend/public/office-pixel/ — not an error, just "no art yet".
    return null;
  }
}

// --- placeholder tileset generation ------------------------------------------
//
// Draws simple tinted vector shapes and rasterizes them into textures under
// the exact same TileKey keys real art will use. This is intentionally not
// meant to look like finished pixel art — see ASSETS.md.

function buildPlaceholderTiles(renderer: Renderer): Record<TileKey, Texture> {
  const tiles = {} as Record<TileKey, Texture>;
  for (const key of TILE_KEYS) {
    tiles[key] = rasterize(renderer, drawTile(key));
  }
  return tiles;
}

const FRAME_RECT = new Rectangle(0, 0, FRAME_SIZE, FRAME_SIZE);

function rasterize(renderer: Renderer, graphics: Graphics): Texture {
  return renderer.generateTexture({
    target: graphics,
    frame: FRAME_RECT,
    textureSourceOptions: { scaleMode: 'nearest' },
  });
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
