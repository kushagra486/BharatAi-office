#!/usr/bin/env python3
"""
Generates the office floor's pixel-art assets from scratch — no imported
tilesets, no stock/licensed sprite packs, no reference tracing. Every pixel
is placed explicitly below. Run with: python3 generate-pixel-art.py

Output matches frontend/components/office-pixel/ASSETS.md exactly:
  frontend/public/office-pixel/characters.png + characters.json
  frontend/public/office-pixel/tileset.png    + tileset.json

Character frames are authored on a 16x16 logical grid in a grayscale
palette, then nearest-neighbor upscaled 2x to the spec's 32x32. Grayscale
is deliberate: PixiJS applies each agent's color via `.tint` (RGB multiply)
at runtime, so near-black pixels (outline, eyes) stay dark under any tint
while light-gray/white pixels become that agent's vivid color — the same
texture reproduces all 11 agent colors with real shading, not just a flat
recolor. Tiles are authored directly in the app's real design tokens
(shared/src/tokens.ts) since they are not tinted at runtime.
"""

import json
import os

from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "office-pixel")
os.makedirs(OUT_DIR, exist_ok=True)

LOGICAL = 16  # design grid
SCALE = 2  # -> 32x32 final, matching FRAME_SIZE/TILE_SIZE in coords.ts/assets.ts
FRAME = LOGICAL * SCALE

# --- grayscale character palette (tint-multiplied at runtime) --------------
OUTLINE = (26, 26, 26, 255)  # stays near-black under any tint
FACE = (15, 15, 15, 255)  # eyes — stays dark/legible under any tint
SHADOW = (120, 120, 120, 255)  # -> a darker shade of the tint color
BASE = (218, 218, 218, 255)  # -> the agent's actual color
HIGHLIGHT = (255, 255, 255, 255)  # -> the brightest shade of the tint color
DROP_SHADOW = (10, 10, 10, 70)  # soft grounding shadow, low alpha
TRANSPARENT = (0, 0, 0, 0)

# --- real brand tokens for tiles (not tinted — authored in final color) ----
TOK_VOID = (6, 9, 13, 255)
TOK_PANEL = (14, 20, 28, 255)
TOK_PANEL_ALT = (11, 17, 24, 255)
TOK_LINE = (29, 40, 54, 255)
TOK_LINE_SOFT = (22, 31, 42, 255)
TOK_DESK = (42, 52, 68, 255)
TOK_CYAN = (47, 230, 210, 255)
TOK_AMBER = (255, 180, 84, 255)
TOK_AMBER_FILL = (58, 44, 20, 255)
TOK_VIOLET = (139, 124, 246, 255)
TOK_VIOLET_FILL = (26, 21, 48, 255)
TOK_GREEN = (74, 222, 128, 255)
TOK_GREEN_FILL = (20, 44, 30, 255)
TOK_MAGENTA = (255, 77, 109, 255)
TOK_MAGENTA_FILL = (46, 18, 26, 255)
TOK_CYAN_FILL = (16, 46, 44, 255)
TOK_GLASS = (63, 99, 128, 255)
TOK_GLASS_LIGHT = (110, 160, 190, 255)
TOK_WOOD = (94, 62, 40, 255)
TOK_WOOD_LIGHT = (138, 97, 66, 255)
WHITE = (255, 255, 255, 255)


def new_canvas():
    return {}  # (x, y) -> RGBA tuple, sparse — unset cells stay transparent


def row(canvas, y, start_x, chars, mapping):
    """Paints one row from a compact string, e.g. '.OHHHHHHSO.' where each
    char maps to a color via `mapping` and '.' is transparent (skipped)."""
    for i, ch in enumerate(chars):
        if ch == ".":
            continue
        canvas[(start_x + i, y)] = mapping[ch]


CHAR_MAP = {
    "O": OUTLINE,
    "H": HIGHLIGHT,
    "B": BASE,
    "S": SHADOW,
    "F": FACE,
    "D": DROP_SHADOW,
}


def paint_block(canvas, x0, y0, x1, y1):
    """
    Paints a hard-edged rectangular block: a 1px OUTLINE border (skipped on
    the short top/bottom edge of blocks under 3px tall, e.g. legs, so they
    don't render as solid outline bars) and, for blocks 6px+ wide, a
    HIGHLIGHT column on the left and a SHADOW column on the right flanking a
    flat BASE fill — a lit-from-upper-left "cube face" instead of the old
    soft rounded gradient. This is the one shape primitive the whole
    Minecraft-style blocky rig (head/torso/arms/legs) is built from.
    """
    width = x1 - x0 + 1
    height = y1 - y0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            on_v_edge = x in (x0, x1)
            on_h_edge = height >= 3 and y in (y0, y1)
            if on_v_edge or on_h_edge:
                canvas[(x, y)] = OUTLINE
            elif width >= 6 and x == x0 + 1:
                canvas[(x, y)] = HIGHLIGHT
            elif width >= 6 and x == x1 - 1:
                canvas[(x, y)] = SHADOW
            else:
                canvas[(x, y)] = BASE


def base_character(eyes: str):
    """
    eyes: 'both' | 'none' | 'left' | 'right' — which eye pixels to paint.
    Builds the down-facing Minecraft-style blocky silhouette on the 16x16
    grid — a squared-off head block, a squared torso, flanking arm blocks,
    and two stubby leg blocks — instead of the old rounded-hood gradient.
    Direction variants reuse this exact shape, varying only which eye
    pixels get painted.
    """
    c = new_canvas()
    paint_block(c, 4, 0, 11, 6)  # head
    paint_block(c, 3, 8, 12, 12)  # torso
    paint_block(c, 0, 8, 2, 12)  # left arm
    paint_block(c, 13, 8, 15, 12)  # right arm
    paint_block(c, 4, 13, 6, 14)  # left leg
    paint_block(c, 9, 13, 11, 14)  # right leg
    row(c, 15, 4, "DDDDDDDD", CHAR_MAP)  # drop shadow, matches head width

    if eyes in ("both", "left"):
        c[(6, 3)] = FACE
    if eyes in ("both", "right"):
        c[(9, 3)] = FACE
    return c


POSE_DOWN = base_character("both")
POSE_UP = base_character("none")
POSE_LEFT = base_character("left")
POSE_RIGHT = base_character("right")

DIRECTIONS = {"down": POSE_DOWN, "up": POSE_UP, "left": POSE_LEFT, "right": POSE_RIGHT}

IDLE_OFFSETS = [(0, 0), (0, -1)]
WALK_OFFSETS = [(0, 0), (-1, -1), (0, 0), (1, -1)]


def render_frame(pose: dict, dx: int, dy: int) -> Image.Image:
    img = Image.new("RGBA", (LOGICAL, LOGICAL), TRANSPARENT)
    px = img.load()
    for (x, y), color in pose.items():
        nx, ny = x + dx, y + dy
        if 0 <= nx < LOGICAL and 0 <= ny < LOGICAL:
            px[nx, ny] = color
    return img.resize((FRAME, FRAME), Image.NEAREST)


def build_character_frames():
    frames = {}
    for direction, pose in DIRECTIONS.items():
        for i, (dx, dy) in enumerate(IDLE_OFFSETS):
            frames[f"idle_{direction}_{i}"] = render_frame(pose, dx, dy)
        for i, (dx, dy) in enumerate(WALK_OFFSETS):
            frames[f"walk_{direction}_{i}"] = render_frame(pose, dx, dy)
    return frames


# --- tiles -------------------------------------------------------------------


def tile_canvas():
    return [[TOK_PANEL for _ in range(LOGICAL)] for _ in range(LOGICAL)]


def fill_rect(grid, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < LOGICAL and 0 <= y < LOGICAL:
                grid[y][x] = color


def border(grid, color):
    for x in range(LOGICAL):
        grid[0][x] = color
        grid[LOGICAL - 1][x] = color
    for y in range(LOGICAL):
        grid[y][0] = color
        grid[y][LOGICAL - 1] = color


def grid_to_image(grid) -> Image.Image:
    img = Image.new("RGBA", (LOGICAL, LOGICAL))
    px = img.load()
    for y in range(LOGICAL):
        for x in range(LOGICAL):
            px[x, y] = grid[y][x]
    return img.resize((FRAME, FRAME), Image.NEAREST)


def build_tile_floor_a():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    # deterministic dither noise (a fixed pixel set, not randomized, so
    # rebuilds are reproducible) — a chunkier, blockier block-texture feel
    # instead of a perfectly flat fill.
    for x, y in [(2, 2), (9, 3), (13, 4), (5, 8), (10, 10), (3, 12), (12, 13)]:
        g[y][x] = TOK_LINE_SOFT
    for x, y in [(6, 6), (12, 9)]:
        g[y][x] = TOK_PANEL_ALT
    return grid_to_image(g)


def build_tile_floor_b():
    g = [[TOK_PANEL_ALT for _ in range(LOGICAL)] for _ in range(LOGICAL)]
    border(g, TOK_LINE_SOFT)
    # a scatter of subtle flecks so it doesn't read as perfectly flat
    for x, y in [(4, 5), (11, 9), (7, 12), (2, 3), (13, 6), (9, 2), (5, 13), (12, 11)]:
        g[y][x] = TOK_LINE
    for x, y in [(8, 8), (3, 9)]:
        g[y][x] = TOK_PANEL
    return grid_to_image(g)


def build_tile_wall_edge():
    g = tile_canvas()
    fill_rect(g, 0, 0, 15, 4, TOK_VOID)
    fill_rect(g, 0, 4, 15, 4, TOK_LINE)  # trim highlight line
    border(g, TOK_LINE_SOFT)
    return grid_to_image(g)


def build_tile_desk():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 2, 5, 13, 12, TOK_DESK)
    fill_rect(g, 2, 5, 13, 5, TOK_LINE)  # desk edge highlight
    fill_rect(g, 4, 7, 9, 9, TOK_VOID)  # "monitor" recess
    g[8][6] = TOK_CYAN
    g[8][7] = TOK_CYAN
    return grid_to_image(g)


def build_tile_review_table():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 1, 4, 14, 13, TOK_AMBER_FILL)
    fill_rect(g, 1, 4, 14, 4, TOK_AMBER)
    fill_rect(g, 1, 13, 14, 13, TOK_AMBER)
    fill_rect(g, 1, 4, 1, 13, TOK_AMBER)
    fill_rect(g, 14, 4, 14, 13, TOK_AMBER)
    return grid_to_image(g)


def build_tile_nova_office():
    g = [[TOK_VIOLET_FILL for _ in range(LOGICAL)] for _ in range(LOGICAL)]
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 3, 5, 12, 12, TOK_VOID)
    fill_rect(g, 3, 5, 12, 5, TOK_VIOLET)
    fill_rect(g, 3, 12, 12, 12, TOK_VIOLET)
    fill_rect(g, 3, 5, 3, 12, TOK_VIOLET)
    fill_rect(g, 12, 5, 12, 12, TOK_VIOLET)
    # small hub/star glyph, orchestrator marker
    for x, y in [(7, 8), (8, 8), (7, 9), (8, 9)]:
        g[y][x] = TOK_VIOLET
    return grid_to_image(g)


def build_tile_window():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 2, 3, 13, 12, TOK_GLASS)
    fill_rect(g, 2, 3, 13, 3, TOK_GLASS_LIGHT)  # sky glare along the top
    fill_rect(g, 7, 3, 8, 12, TOK_LINE)  # vertical mullion
    fill_rect(g, 2, 7, 13, 8, TOK_LINE)  # horizontal mullion
    return grid_to_image(g)


def build_tile_wall_inner():
    g = [[TOK_VOID for _ in range(LOGICAL)] for _ in range(LOGICAL)]
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 0, 7, 15, 8, TOK_LINE)  # partition seam band, distinguishes from the exterior wall_edge
    return grid_to_image(g)


def build_tile_plant():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 6, 11, 9, 13, TOK_WOOD)
    fill_rect(g, 6, 11, 9, 11, TOK_WOOD_LIGHT)
    leaf_pixels = [
        (7, 4), (8, 4),
        (6, 5), (7, 5), (8, 5), (9, 5),
        (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6),
        (6, 7), (7, 7), (8, 7), (9, 7),
        (7, 8), (8, 8),
    ]
    for x, y in leaf_pixels:
        g[y][x] = TOK_GREEN
    return grid_to_image(g)


def build_tile_water_cooler():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 5, 10, 10, 13, TOK_PANEL_ALT)
    fill_rect(g, 5, 10, 10, 10, TOK_LINE)
    fill_rect(g, 6, 4, 9, 9, TOK_GLASS_LIGHT)
    fill_rect(g, 6, 4, 9, 4, WHITE)
    return grid_to_image(g)


def build_tile_printer():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 3, 6, 12, 12, TOK_PANEL_ALT)
    fill_rect(g, 3, 6, 12, 7, TOK_LINE)
    fill_rect(g, 5, 9, 10, 10, TOK_VOID)
    g[9][7] = TOK_AMBER
    g[9][8] = TOK_AMBER
    return grid_to_image(g)


def build_tile_bookshelf():
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 2, 2, 13, 13, TOK_WOOD)
    fill_rect(g, 3, 3, 12, 12, TOK_PANEL_ALT)
    spines = [TOK_CYAN, TOK_AMBER, TOK_VIOLET, TOK_MAGENTA, TOK_GREEN]
    x = 4
    for color in spines:
        fill_rect(g, x, 4, x, 11, color)
        x += 2
    return grid_to_image(g)


def build_tile_rug(fill_color, accent_color):
    g = tile_canvas()
    border(g, TOK_LINE_SOFT)
    fill_rect(g, 1, 1, 14, 14, fill_color)
    fill_rect(g, 1, 1, 14, 1, accent_color)
    fill_rect(g, 1, 14, 14, 14, accent_color)
    fill_rect(g, 1, 1, 1, 14, accent_color)
    fill_rect(g, 14, 1, 14, 14, accent_color)
    return grid_to_image(g)


TILE_BUILDERS = {
    "floor_a": build_tile_floor_a,
    "floor_b": build_tile_floor_b,
    "wall_edge": build_tile_wall_edge,
    "wall_inner": build_tile_wall_inner,
    "window": build_tile_window,
    "desk": build_tile_desk,
    "review_table": build_tile_review_table,
    "nova_office": build_tile_nova_office,
    "plant": build_tile_plant,
    "water_cooler": build_tile_water_cooler,
    "printer": build_tile_printer,
    "bookshelf": build_tile_bookshelf,
    "rug_eng": lambda: build_tile_rug(TOK_CYAN_FILL, TOK_CYAN),
    "rug_design": lambda: build_tile_rug(TOK_AMBER_FILL, TOK_AMBER),
    "rug_data": lambda: build_tile_rug(TOK_GREEN_FILL, TOK_GREEN),
    "rug_ops": lambda: build_tile_rug(TOK_MAGENTA_FILL, TOK_MAGENTA),
}


# --- packing + atlas JSON ----------------------------------------------------


def pack_sheet(frames: dict, cols: int, out_png: str, out_json: str):
    names = list(frames.keys())
    rows = (len(names) + cols - 1) // cols
    sheet_w, sheet_h = cols * FRAME, rows * FRAME
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    atlas_frames = {}
    for idx, name in enumerate(names):
        col, r = idx % cols, idx // cols
        x, y = col * FRAME, r * FRAME
        sheet.paste(frames[name], (x, y))
        atlas_frames[name] = {
            "frame": {"x": x, "y": y, "w": FRAME, "h": FRAME},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
            "sourceSize": {"w": FRAME, "h": FRAME},
        }

    sheet.save(out_png)
    atlas = {
        "frames": atlas_frames,
        "meta": {
            "app": "generate-pixel-art.py",
            "image": os.path.basename(out_png),
            "format": "RGBA8888",
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1",
        },
    }
    with open(out_json, "w") as f:
        json.dump(atlas, f, indent=2)
    print(f"wrote {out_png} ({sheet_w}x{sheet_h}, {len(names)} frames)")
    print(f"wrote {out_json}")


def main():
    characters = build_character_frames()
    assert len(characters) == 24, f"expected 24 character frames, got {len(characters)}"
    pack_sheet(
        characters,
        cols=6,
        out_png=os.path.join(OUT_DIR, "characters.png"),
        out_json=os.path.join(OUT_DIR, "characters.json"),
    )

    tiles = {key: builder() for key, builder in TILE_BUILDERS.items()}
    pack_sheet(
        tiles,
        cols=4,
        out_png=os.path.join(OUT_DIR, "tileset.png"),
        out_json=os.path.join(OUT_DIR, "tileset.json"),
    )


if __name__ == "__main__":
    main()
