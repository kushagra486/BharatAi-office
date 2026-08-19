# Office floor pixel-art asset spec

The office floor renders real hand-authored pixel art —
`frontend/public/office-pixel/{characters,tileset}.{png,json}` — generated
by `frontend/scripts/generate-pixel-art.py`. Every pixel is placed
explicitly in that script; nothing is traced, generated from a reference
image, or pulled from a stock/licensed sprite pack (see the project PRD's
IP note). `assets.ts`'s `loadOfficeAssets()` loads these first and only
falls back to a procedural placeholder if they're missing, so the code
never depends on either asset source specifically — this doc is the
contract both must satisfy.

To regenerate or restyle the art, edit `generate-pixel-art.py` and re-run
it (`python3 frontend/scripts/generate-pixel-art.py`, requires Pillow) —
or replace its output with art from any other pixel-art tool (Aseprite,
etc.) as long as it matches the spec below exactly.

## Character sheet — `frontend/public/office-pixel/characters.json` (+ PNG)

- Export format: Aseprite/TexturePacker-style JSON hash atlas, loadable via `PIXI.Assets.load()`.
- Frame size: 32×32px per frame.
- One base rig only — per-agent color comes from runtime `.tint`, not separate art per agent. The rig is drawn in a **grayscale palette** (near-black outline/eyes, mid-gray shadow, light-gray base, white highlight) so `.tint` reproduces each agent's exact color while the outline and eyes stay dark and legible under any tint, and the shadow/highlight grays produce real shading, not a flat recolor.
- Required frame keys (must match exactly — see `CharacterFrameKey` in `assets.ts`):
  - `idle_down_0`, `idle_down_1`, `idle_up_0`, `idle_up_1`, `idle_left_0`, `idle_left_1`, `idle_right_0`, `idle_right_1` — 2-frame idle bob loop per direction.
  - `walk_down_0..3`, `walk_up_0..3`, `walk_left_0..3`, `walk_right_0..3` — 4-frame walk cycle per direction.
- 24 frames total. Direction is communicated by eye placement (both eyes down, none up, one eye left/right) plus a small body offset per animation frame — see `generate-pixel-art.py`'s `base_character()`/`render_frame()`.

## Tileset — `frontend/public/office-pixel/tileset.json` (+ PNG)

- Same export format as above.
- Tile size: 32×32px.
- Required tile keys (must match exactly — see `TileKey` in `assets.ts`): `floor_a`, `floor_b`, `wall_edge`, `desk`, `review_table`, `nova_office`.
- Tiles are **not** tinted at runtime, so they're authored directly in the app's real design tokens (`shared/src/tokens.ts`) — `desk` carries a cyan monitor glow, `review_table` an amber border, `nova_office` a violet-bordered mat with a small hub glyph — so the floor reads as the same brand as the rest of the UI, not a generic pixel-game tileset.

## Department badges & status dots

Not part of the sprite sheet — these stay small vector shapes drawn directly
in `CharacterSprite.ts` (ported from the old `WalkerAvatar.tsx`'s
`ShapePath`), composited above the character sprite.

## Swapping in different art later

1. Drop replacement `characters.json`/`.png` and `tileset.json`/`.png` into
   `frontend/public/office-pixel/`, matching the frame/tile keys above.
2. Reload — `loadOfficeAssets()` in `assets.ts` tries the real sheet first
   and only falls back to the procedural placeholder if it 404s. No other
   change needed.
