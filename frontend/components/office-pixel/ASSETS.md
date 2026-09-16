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
- Silhouette is a **Minecraft-style blocky rig**: a squared head block, a squared torso, flanking arm blocks, and two stubby leg blocks, each a hard-edged rectangle with a 1px outline and a flat highlight/shadow column pair (see `paint_block()` in `generate-pixel-art.py`) — not the earlier rounded-hood gradient.
- Required frame keys (must match exactly — see `CharacterFrameKey` in `assets.ts`):
  - `idle_down_0`, `idle_down_1`, `idle_up_0`, `idle_up_1`, `idle_left_0`, `idle_left_1`, `idle_right_0`, `idle_right_1` — 2-frame idle bob loop per direction.
  - `walk_down_0..3`, `walk_up_0..3`, `walk_left_0..3`, `walk_right_0..3` — 4-frame walk cycle per direction.
- 24 frames total. Direction is communicated by eye placement (both eyes down, none up, one eye left/right) plus a small body offset per animation frame — see `generate-pixel-art.py`'s `base_character()`/`render_frame()`.

## Tileset — `frontend/public/office-pixel/tileset.json` (+ PNG)

- Same export format as above.
- Tile size: 32×32px.
- Required tile keys (must match exactly — see `TileKey` in `assets.ts`): `floor_a`, `floor_b`, `wall_edge`, `wall_inner`, `window`, `desk`, `review_table`, `nova_office`, `plant`, `water_cooler`, `printer`, `bookshelf`, `rug_eng`, `rug_design`, `rug_data`, `rug_ops`.
- Tiles are **not** tinted at runtime, so they're authored directly in the app's real design tokens (`shared/src/tokens.ts`) — `desk` carries a cyan monitor glow, `review_table` an amber border, `nova_office` a violet-bordered mat with a small hub glyph — so the floor reads as the same brand as the rest of the UI, not a generic pixel-game tileset.
- The `rug_*` tiles are laid under each employee's desk keyed by department (`eng`→cyan, `design`→amber, `data`→green, `ops`→magenta — see `DEPT_RUG` in `pixiScene.ts`), so the two desk rows read as distinct team zones without moving anyone's fixed `home_x`/`home_y`.
- `wall_inner` partitions Nova's desk into its own small enclosed office (walls + a 2-tile door gap, see `NOVA_WALL_*` constants in `pixiScene.ts`); `window` punches a few tiles into the exterior `wall_edge` ring. `plant`/`water_cooler`/`printer`/`bookshelf` are freestanding set-dressing placed in the aisles the desks don't occupy (`DECOR_PROPS` in `pixiScene.ts`).

## Department badges & status dots

Not part of the sprite sheet — these stay small vector shapes drawn directly
in `CharacterSprite.ts` (ported from the old `WalkerAvatar.tsx`'s
`ShapePath`), composited above the character sprite. They always carry the
agent's identity color (`TOKEN_TINT[agent.color]`) even when that agent is
using a custom per-agent sprite (see below), so shape + color stay
meaningful regardless of art source.

## Character mapping

The 11 roster ids (`shared/src/roster.ts`), with the identity each one
currently renders as — this is the full "who is who" reference for naming
custom sprite files (§ below) and for prompting/briefing an artist per
agent.

| Agent id | Name | Role | Department | Badge shape | Current color |
|---|---|---|---|---|---|
| `nova` | Nova | Orchestrator | orchestrator | octagon | violet `#8B7CF6` |
| `kael` | Kael | Solutions Architect | eng | hexagon | red `#FF4D4D` |
| `priya` | Priya | Backend Developer | eng | hexagon | orange `#FF9433` |
| `devraj` | Devraj | Frontend Developer | eng | hexagon | gold `#FFD23F` |
| `simran` | Simran | UI/UX Designer | design | diamond | lime `#A8E62E` |
| `arjun` | Arjun | QA Engineer | eng | hexagon | emerald `#2ECC71` |
| `meera` | Meera | Data/Analytics | data | circle | cyan `#2FE6D2` |
| `raghav` | Raghav | Security Reviewer | eng | hexagon | sky blue `#38BDF8` |
| `tanya` | Tanya | Technical Writer | data | circle | blue `#5B7FFF` |
| `farhan` | Farhan | DevOps Engineer | ops | rounded square | pink `#FF4FC3` |
| `isha` | Isha | Project Coordinator | ops | rounded square | rose `#FF4D79` |

The "current color" is only used when an agent has **no** custom sprite
(the shared rig tinted via `.tint`) — a custom per-agent sheet renders in
whatever colors are actually in its PNG, so it doesn't need to match this
column at all. Badge shape (department marker, drawn separately — see
below) always stays regardless of sprite source.

## Per-agent custom sprites (real photos / custom art per employee)

By default all 11 agents share the one grayscale rig above, recolored per
agent via runtime `.tint`. If you want each agent to have their own
distinct art (e.g. a photo turned into a custom pixel sprite) instead of a
shared recolored rig, drop a **complete replacement sheet per agent** at:

```
frontend/public/office-pixel/characters/<agentId>.json
frontend/public/office-pixel/characters/<agentId>.png
```

- Same export format, frame size (32×32) and the same 24 frame keys as the
  shared sheet above — a custom sheet must be a full walk+idle cycle in all
  4 directions, not a single static image (the AnimatedSprite always asks
  for `walk_left_2` etc.; a missing key throws).
- Author it in **real color**, not grayscale — a per-agent sheet is drawn
  untinted (`CharacterSprite.ts` skips `.tint` whenever
  `characterFramesByAgent[agentId]` exists), so whatever colors are in the
  PNG are exactly what renders.
- `<agentId>` must be one of the 11 roster ids (`shared/src/roster.ts`):
  `nova`, `kael`, `priya`, `devraj`, `simran`, `arjun`, `meera`, `raghav`,
  `tanya`, `farhan`, `isha`.
- **Fully incremental**: `loadOfficeAssets()` (`assets.ts`) tries each of
  the 11 possible per-agent files independently and silently skips any
  that 404. Drop in one, five, or all eleven — everyone else keeps using
  the shared tinted rig. No code change needed either way.
- Turning a real photo into this format is a manual/AI-assisted pixel-art
  pass, not an automatic conversion — a photo has no walk cycle or
  4-direction facing to pull frames from. `generate-pixel-art.py`'s
  `paint_block()`/`base_character()` is a reasonable reference for the
  frame layout and grid size if you want to hand-author or prompt an image
  model for each frame.

## Full asset inventory

Everything that can currently be visually replaced in the office scene —
nothing else in the app (the surrounding dashboard chrome: HudBar, panels,
roster, charts) uses image assets, it's all CSS/SVG/text.

| Key | File | What it is | Where it's used |
|---|---|---|---|
| `idle_down/up/left/right_0-1`, `walk_down/up/left/right_0-3` | `characters.json/png` (shared) or `characters/<agentId>.json/png` (per-agent) | The 24-frame walk/idle rig | Every agent's on-floor character |
| `floor_a` / `floor_b` | `tileset.json/png` | The two alternating base floor tones | Every non-wall, non-decor tile |
| `wall_edge` | `tileset.json/png` | Exterior boundary wall | Outer ring of the floor grid |
| `wall_inner` | `tileset.json/png` | Interior partition wall | Nova's enclosed office walls |
| `window` | `tileset.json/png` | A window punched into the exterior wall | A few columns of the top exterior wall |
| `desk` | `tileset.json/png` | An employee's desk (with monitor glow) | Under each of the 10 employees' home position |
| `nova_office` | `tileset.json/png` | Nova's desk mat (violet, hub glyph) | Under Nova's home position |
| `review_table` | `tileset.json/png` | A meeting-table tile (amber border) | Currently unused in the render — kept in the atlas in case you want to reintroduce a visible marker at `REVIEW_TABLE_POSITION`; agents still walk to that spot on task completion, it's just not drawn today |
| `plant` | `tileset.json/png` | A potted plant | 3 fixed spots (corners + bottom-center) |
| `water_cooler` | `tileset.json/png` | A water cooler | 1 fixed spot, left aisle |
| `printer` | `tileset.json/png` | A printer | 1 fixed spot, right aisle |
| `bookshelf` | `tileset.json/png` | A bookshelf with colored spines | 2 fixed spots, bottom corners |
| `rug_eng` | `tileset.json/png` | Cyan department rug | Under eng-dept desks (Kael, Priya, Devraj, Arjun, Raghav) |
| `rug_design` | `tileset.json/png` | Amber department rug | Under design-dept desks (Simran) |
| `rug_data` | `tileset.json/png` | Green department rug | Under data-dept desks (Meera, Tanya) |
| `rug_ops` | `tileset.json/png` | Magenta department rug | Under ops-dept desks (Farhan, Isha) |

Exact pixel positions for every tile/prop/wall/window/rug live in
`pixiScene.ts` (`DECOR_PROPS`, `WINDOW_COLS`, `NOVA_WALL_*`, `DEPT_RUG`,
`buildFloorLayer`/`buildDecorLayer`) if you need to relocate something
rather than just re-skin it.

## Swapping in different art later

1. Drop replacement `characters.json`/`.png` and `tileset.json`/`.png` into
   `frontend/public/office-pixel/` (shared rig + tileset), and/or
   `characters/<agentId>.json`/`.png` (per-agent overrides) — matching the
   frame/tile keys above.
2. Reload — `loadOfficeAssets()` in `assets.ts` tries real art first and
   only falls back to the procedural placeholder (for the shared rig/tiles)
   or the shared tinted rig (for an agent with no override) if something's
   missing. No other change needed.
