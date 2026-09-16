#!/usr/bin/env python3
"""
Generates the office floor's tileset and the shared fallback character rig
from scratch — no imported tilesets, no stock/licensed sprite packs, no
reference tracing. Every pixel is placed explicitly below. Run with:
python3 generate-pixel-art.py

Output matches frontend/components/office-pixel/ASSETS.md exactly:
  frontend/public/office-pixel/tileset.png    + tileset.json
  frontend/public/office-pixel/characters.png + characters.json

This is a warm, light "retro office-sim" palette (cream walls, sage floor,
wood furniture) — a deliberate original take on that genre's look, not a
copy of any specific game's assets. The shared character rig here is drawn
in a grayscale palette (near-black outline, mid-gray shadow, light-gray
base, white highlight) so runtime `.tint` (CharacterSprite.ts) can recolor
it per agent as a fallback when an agent has no distinct sheet of its own —
see generate-agent-sprites.py for the real per-agent art.
"""

import json
import os

from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "office-pixel")
os.makedirs(OUT_DIR, exist_ok=True)

LOGICAL = 16  # design grid
SCALE = 2  # -> 32x32 final, matching TILE_SIZE/FRAME_SIZE in coords.ts/assets.ts
FRAME = LOGICAL * SCALE
TRANSPARENT = (0, 0, 0, 0)

# --- warm "retro office" tile tokens (authored directly, not tinted) --------
WALL = (235, 230, 216, 255)
WALL_TRIM = (196, 186, 158, 255)
WALL_DARK = (168, 156, 128, 255)
FLOOR_A = (150, 173, 138, 255)
FLOOR_B = (139, 163, 127, 255)
FLOOR_DOT = (128, 152, 116, 255)
FLOOR_DOT_ALT = (161, 183, 150, 255)
LINE = (94, 82, 62, 255)  # warm dark outline, replaces the old cool navy grid line
WOOD = (196, 149, 92, 255)
WOOD_LIGHT = (216, 173, 116, 255)
WOOD_DARK = (154, 110, 62, 255)
TABLE_WOOD = (139, 94, 52, 255)
CHAIR = (122, 59, 66, 255)
CHAIR_LIGHT = (150, 82, 88, 255)
MONITOR_BEZEL = (232, 228, 218, 255)
MONITOR_SCREEN = (58, 66, 74, 255)
MONITOR_GLOW = (120, 190, 214, 255)
GOLD = (214, 168, 84, 255)
GOLD_FILL = (238, 220, 178, 255)
GLASS = (176, 205, 216, 255)
GLASS_LIGHT = (214, 232, 236, 255)
PLANT_LEAF = (96, 140, 78, 255)
PLANT_LEAF_LIGHT = (128, 172, 102, 255)
PLANT_POT = (181, 113, 74, 255)
WATER_BLUE = (150, 196, 214, 255)
AMBER_LIGHT = (222, 160, 82, 255)
BOOK_TEAL = (140, 186, 172, 255)
BOOK_AMBER = (214, 176, 116, 255)
BOOK_VIOLET = (170, 156, 196, 255)
BOOK_ROSE = (200, 146, 152, 255)
BOOK_GREEN = (146, 178, 130, 255)
RUG_ENG = (188, 214, 206, 255)
RUG_ENG_TRIM = (138, 178, 164, 255)
RUG_DESIGN = (228, 210, 176, 255)
RUG_DESIGN_TRIM = (196, 158, 100, 255)
RUG_DATA = (196, 214, 182, 255)
RUG_DATA_TRIM = (146, 180, 120, 255)
RUG_OPS = (224, 194, 196, 255)
RUG_OPS_TRIM = (188, 130, 138, 255)
WHITE = (250, 248, 244, 255)

# --- grayscale character palette (tint-multiplied at runtime) --------------
OUTLINE = (28, 24, 20, 255)  # warm near-black, stays dark under any tint
FACE = (18, 15, 12, 255)  # eyes
SHADOW = (128, 122, 112, 255)  # -> a darker shade of the tint color
BASE = (220, 216, 206, 255)  # -> the agent's actual color
HIGHLIGHT = (255, 253, 248, 255)  # -> the brightest shade of the tint color
SKIN = (222, 180, 140, 255)  # fallback skin tone (untinted, always drawn as-is)
DROP_SHADOW = (20, 16, 12, 60)


# --- tiles -------------------------------------------------------------------


def tile_canvas(fill=FLOOR_A):
    return [[fill for _ in range(LOGICAL)] for _ in range(LOGICAL)]


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
    # No border() here on purpose: adjacent floor tiles should blend into one
    # continuous surface (a real floor, not visible grid squares) — only the
    # alternating floor_a/floor_b base tone and this dither texture carry
    # definition. Deterministic dither noise (a fixed pixel set, not
    # randomized, so rebuilds are reproducible) reads as a soft carpet/tile
    # weave instead of a flat fill.
    g = tile_canvas(FLOOR_A)
    for x, y in [(2, 2), (9, 3), (13, 4), (5, 8), (10, 10), (3, 12), (12, 13)]:
        g[y][x] = FLOOR_DOT
    for x, y in [(6, 6), (12, 9)]:
        g[y][x] = FLOOR_DOT_ALT
    return grid_to_image(g)


def build_tile_floor_b():
    g = tile_canvas(FLOOR_B)
    for x, y in [(4, 5), (11, 9), (7, 12), (2, 3), (13, 6), (9, 2), (5, 13), (12, 11)]:
        g[y][x] = FLOOR_DOT
    for x, y in [(8, 8), (3, 9)]:
        g[y][x] = FLOOR_DOT_ALT
    return grid_to_image(g)


def build_tile_wall_edge():
    g = tile_canvas(WALL)
    fill_rect(g, 0, 0, 15, 3, WALL)
    fill_rect(g, 0, 4, 15, 4, WALL_TRIM)  # baseboard trim line
    fill_rect(g, 0, 5, 15, 15, FLOOR_A)
    border(g, WALL_DARK)
    return grid_to_image(g)


def build_tile_desk():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 2, 5, 13, 12, WOOD)
    fill_rect(g, 2, 5, 13, 6, WOOD_LIGHT)  # desk top highlight
    fill_rect(g, 2, 11, 13, 12, WOOD_DARK)  # desk front shadow
    fill_rect(g, 4, 6, 9, 9, MONITOR_BEZEL)
    fill_rect(g, 5, 7, 8, 8, MONITOR_SCREEN)
    g[7][6] = MONITOR_GLOW
    g[7][7] = MONITOR_GLOW
    return grid_to_image(g)


def build_tile_review_table():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 1, 4, 14, 13, TABLE_WOOD)
    fill_rect(g, 1, 4, 14, 5, WOOD_LIGHT)
    fill_rect(g, 1, 4, 1, 13, CHAIR)
    fill_rect(g, 14, 4, 14, 13, CHAIR)
    fill_rect(g, 1, 4, 14, 4, CHAIR_LIGHT)
    return grid_to_image(g)


def build_tile_nova_office():
    g = tile_canvas(GOLD_FILL)
    border(g, LINE)
    fill_rect(g, 3, 5, 12, 12, WOOD)
    fill_rect(g, 3, 5, 12, 6, WOOD_LIGHT)
    fill_rect(g, 3, 5, 12, 5, GOLD)
    fill_rect(g, 3, 12, 12, 12, GOLD)
    fill_rect(g, 3, 5, 3, 12, GOLD)
    fill_rect(g, 12, 5, 12, 12, GOLD)
    # small star/hub glyph — the one remaining "orchestrator" marker
    for x, y in [(7, 8), (8, 8), (7, 9), (8, 9)]:
        g[y][x] = GOLD
    return grid_to_image(g)


def build_tile_window():
    g = tile_canvas(WALL)
    border(g, WALL_DARK)
    fill_rect(g, 2, 3, 13, 12, GLASS)
    fill_rect(g, 2, 3, 13, 4, GLASS_LIGHT)  # sky glare along the top
    fill_rect(g, 7, 3, 8, 12, WALL_TRIM)  # vertical mullion
    fill_rect(g, 2, 7, 13, 8, WALL_TRIM)  # horizontal mullion
    return grid_to_image(g)


def build_tile_wall_inner():
    g = tile_canvas(WALL)
    border(g, WALL_DARK)
    fill_rect(g, 0, 7, 15, 8, WALL_TRIM)  # partition seam band, distinguishes from the exterior wall_edge
    return grid_to_image(g)


def build_tile_plant():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 6, 11, 9, 13, WOOD_DARK)
    fill_rect(g, 6, 11, 9, 11, PLANT_POT)
    leaf_pixels = [
        (7, 4), (8, 4),
        (6, 5), (7, 5), (8, 5), (9, 5),
        (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6),
        (6, 7), (7, 7), (8, 7), (9, 7),
        (7, 8), (8, 8),
    ]
    for x, y in leaf_pixels:
        g[y][x] = PLANT_LEAF
    for x, y in [(7, 5), (8, 6)]:
        g[y][x] = PLANT_LEAF_LIGHT
    return grid_to_image(g)


def build_tile_water_cooler():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 5, 10, 10, 13, MONITOR_BEZEL)
    fill_rect(g, 5, 10, 10, 10, WALL_TRIM)
    fill_rect(g, 6, 4, 9, 9, WATER_BLUE)
    fill_rect(g, 6, 4, 9, 4, WHITE)
    return grid_to_image(g)


def build_tile_printer():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 3, 6, 12, 12, MONITOR_BEZEL)
    fill_rect(g, 3, 6, 12, 7, WALL_TRIM)
    fill_rect(g, 5, 9, 10, 10, WOOD_DARK)
    g[9][7] = AMBER_LIGHT
    g[9][8] = AMBER_LIGHT
    return grid_to_image(g)


def build_tile_bookshelf():
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
    fill_rect(g, 2, 2, 13, 13, WOOD_DARK)
    fill_rect(g, 3, 3, 12, 12, WOOD)
    spines = [BOOK_TEAL, BOOK_AMBER, BOOK_VIOLET, BOOK_ROSE, BOOK_GREEN]
    x = 4
    for color in spines:
        fill_rect(g, x, 4, x, 11, color)
        x += 2
    return grid_to_image(g)


def build_tile_rug(fill_color, accent_color):
    g = tile_canvas(FLOOR_A)
    border(g, LINE)
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
    "rug_eng": lambda: build_tile_rug(RUG_ENG, RUG_ENG_TRIM),
    "rug_design": lambda: build_tile_rug(RUG_DESIGN, RUG_DESIGN_TRIM),
    "rug_data": lambda: build_tile_rug(RUG_DATA, RUG_DATA_TRIM),
    "rug_ops": lambda: build_tile_rug(RUG_OPS, RUG_OPS_TRIM),
}


# --- shared fallback character rig (grayscale, tint-multiplied at runtime) --
#
# A rounded "chibi" humanoid — used only when an agent has no distinct sheet
# of its own (see generate-agent-sprites.py, the real per-agent art). Corner
# pixels of the head block are left transparent to fake a rounded silhouette
# at this resolution, instead of the earlier hard-edged Minecraft-style rig.


def new_canvas():
    return {}


def paint_block(canvas, x0, y0, x1, y1, round_head=False):
    width = x1 - x0 + 1
    height = y1 - y0 + 1
    corners = {(x0, y0), (x0, y1), (x1, y0), (x1, y1)} if round_head else set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) in corners:
                continue
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
    c = new_canvas()
    paint_block(c, 4, 0, 11, 6, round_head=True)  # head
    paint_block(c, 3, 8, 12, 12)  # torso
    paint_block(c, 0, 8, 2, 12)  # left arm
    paint_block(c, 13, 8, 15, 12)  # right arm
    paint_block(c, 4, 13, 6, 14)  # left leg
    paint_block(c, 9, 13, 11, 14)  # right leg
    for x in range(4, 12):
        c[(x, 15)] = DROP_SHADOW

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
    tiles = {key: builder() for key, builder in TILE_BUILDERS.items()}
    pack_sheet(
        tiles,
        cols=4,
        out_png=os.path.join(OUT_DIR, "tileset.png"),
        out_json=os.path.join(OUT_DIR, "tileset.json"),
    )

    characters = build_character_frames()
    assert len(characters) == 24, f"expected 24 character frames, got {len(characters)}"
    pack_sheet(
        characters,
        cols=6,
        out_png=os.path.join(OUT_DIR, "characters.png"),
        out_json=os.path.join(OUT_DIR, "characters.json"),
    )


if __name__ == "__main__":
    main()
