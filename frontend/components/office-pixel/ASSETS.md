# Office floor pixel-art asset spec

This directory currently renders the office floor with **procedurally
generated placeholder textures** (`assets.ts`'s `buildPlaceholderAssets`) —
tinted geometric shapes, not hand-drawn pixel art. That's a deliberate,
scoped choice (see the migration plan): the rendering engine and animation
logic are complete and correct now; real art is a separate, later
workstream that drops in with **no code changes**, as long as it matches
this spec exactly.

Author with any pixel-art tool (Aseprite recommended). Must be 100%
original artwork — no imported tilesets, no recolored stock/licensed sprite
packs (see the project PRD's IP note).

## Character sheet — `frontend/public/office-pixel/characters.json` (+ PNG)

- Export format: Aseprite JSON (hash or array) or TexturePacker-compatible JSON atlas, loadable via `PIXI.Assets.load()`.
- Frame size: 32×32px per frame.
- One base rig only — per-agent color comes from runtime `.tint`, not separate art per agent. Draw the rig in **white/neutral** so tinting reproduces the exact agent color (matching how the placeholder is drawn).
- Required frame keys (must match exactly — see `CharacterFrameKey` in `assets.ts`):
  - `idle_down_0`, `idle_down_1`, `idle_up_0`, `idle_up_1`, `idle_left_0`, `idle_left_1`, `idle_right_0`, `idle_right_1` — 2-frame idle bob loop per direction.
  - `walk_down_0..3`, `walk_up_0..3`, `walk_left_0..3`, `walk_right_0..3` — 4-frame walk cycle per direction.
- 24 frames total.

## Tileset — `frontend/public/office-pixel/tileset.json` (+ PNG)

- Same export format as above.
- Tile size: 32×32px.
- Required tile keys (must match exactly — see `TileKey` in `assets.ts`): `floor_a`, `floor_b`, `wall_edge`, `desk`, `review_table`, `nova_office`.

## Department badges & status dots

Not part of the sprite sheet — these stay small vector shapes drawn directly
in `CharacterSprite.ts` (ported from the old `WalkerAvatar.tsx`'s
`ShapePath`), composited above the character sprite. No art needed for
these; they're intentionally simple geometric icons, not pixel art.

## Swapping in real art

1. Drop `characters.json`/`.png` and `tileset.json`/`.png` into
   `frontend/public/office-pixel/`.
2. Reload — `loadOfficeAssets()` in `assets.ts` tries the real sheet first
   and only falls back to placeholders if it 404s. No other change needed.
