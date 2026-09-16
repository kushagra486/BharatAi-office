#!/usr/bin/env python3
"""
Generates a distinct full-body pixel-art sprite sheet per agent — a rounded
"chibi" top-down office-sim silhouette (head/torso/arms/legs, rounded head
corners), each with its own hairstyle, hair color, skin tone, and a shirt
colored from that agent's real identity color (see TOKEN_TINT in
CharacterSprite.ts / roster.ts) so the floor sprite stays visually tied to
the badge/ring/roster-dot color used everywhere else in the app. This is
original pixel art authored pixel-by-pixel below — not traced from any
reference image or licensed sprite pack.

Run with: python3 generate-agent-sprites.py
Output: frontend/public/office-pixel/characters/<agentId>.png + .json,
one full 24-frame sheet per agent (see ASSETS.md).
"""

import json
import os

from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "office-pixel", "characters")
os.makedirs(OUT_DIR, exist_ok=True)

LOGICAL = 16
SCALE = 2
FRAME = LOGICAL * SCALE
TRANSPARENT = (0, 0, 0, 0)

OUTLINE = (28, 24, 20, 255)
EYE = (24, 20, 16, 255)
SHOE = (36, 32, 30, 255)
PANTS = (64, 60, 68, 255)
PANTS_LIGHT = (82, 78, 86, 255)
DROP_SHADOW = (20, 16, 12, 60)


def lighten(c, amt):
    return tuple(min(255, int(v + (255 - v) * amt)) for v in c[:3]) + (255,)


def darken(c, amt):
    return tuple(max(0, int(v * (1 - amt))) for v in c[:3]) + (255,)


def muted_identity(hex_color: str):
    """Blends a vivid identity hex toward a warm neutral gray so it reads as
    fabric/clothing in the warm retro palette instead of a flat neon fill."""
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    gray = (150, 140, 124)
    blended = tuple(int(v * 0.58 + gray[i] * 0.42) for i, v in enumerate((r, g, b)))
    return blended + (255,)


# --- per-agent identity: hairstyle, hair color, skin tone, shirt color -----

AGENTS = {
    "nova": {"hair": "short", "hair_color": (52, 56, 70, 255), "skin": (206, 164, 122, 255), "shirt": muted_identity("8B7CF6"), "accessory": "band"},
    "kael": {"hair": "short", "hair_color": (40, 36, 34, 255), "skin": (232, 196, 160, 255), "shirt": muted_identity("FF4D4D")},
    "priya": {"hair": "ponytail", "hair_color": (74, 50, 34, 255), "skin": (214, 172, 128, 255), "shirt": muted_identity("FF9433")},
    "devraj": {"hair": "spiky", "hair_color": (34, 30, 28, 255), "skin": (198, 152, 108, 255), "shirt": muted_identity("FFD23F")},
    "simran": {"hair": "bob", "hair_color": (140, 64, 44, 255), "skin": (236, 200, 166, 255), "shirt": muted_identity("A8E62E")},
    "arjun": {"hair": "short", "hair_color": (92, 64, 42, 255), "skin": (210, 168, 124, 255), "shirt": muted_identity("2ECC71"), "accessory": "glasses"},
    "meera": {"hair": "long", "hair_color": (30, 26, 24, 255), "skin": (150, 104, 68, 255), "shirt": muted_identity("2FE6D2")},
    "raghav": {"hair": "short", "hair_color": (120, 108, 96, 255), "skin": (206, 162, 118, 255), "shirt": muted_identity("38BDF8"), "accessory": "stubble"},
    "tanya": {"hair": "bun", "hair_color": (214, 182, 120, 255), "skin": (240, 206, 172, 255), "shirt": muted_identity("5B7FFF")},
    "farhan": {"hair": "cap", "hair_color": (88, 62, 42, 255), "skin": (198, 154, 110, 255), "shirt": muted_identity("FF4FC3"), "cap_color": (74, 92, 96, 255)},
    "isha": {"hair": "bob", "hair_color": (70, 48, 34, 255), "skin": (216, 174, 130, 255), "shirt": muted_identity("FF4D79"), "accessory": "headband"},
}


def new_canvas():
    return {}


def paint_block(canvas, x0, y0, x1, y1, base, round_corners=False):
    width = x1 - x0 + 1
    height = y1 - y0 + 1
    hi = lighten(base, 0.28)
    sh = darken(base, 0.22)
    corners = {(x0, y0), (x0, y1), (x1, y0), (x1, y1)} if round_corners else set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) in corners:
                continue
            on_v_edge = x in (x0, x1)
            on_h_edge = height >= 3 and y in (y0, y1)
            if on_v_edge or on_h_edge:
                canvas[(x, y)] = OUTLINE
            elif width >= 6 and x == x0 + 1:
                canvas[(x, y)] = hi
            elif width >= 6 and x == x1 - 1:
                canvas[(x, y)] = sh
            else:
                canvas[(x, y)] = base


def paint_hair(c, style: str, color, cap_color=None):
    hi = lighten(color, 0.22)
    if style == "short":
        for x in range(4, 12):
            c[(x, 0)] = color
            c[(x, 1)] = hi if x in (5, 8) else color
    elif style == "long":
        for x in range(4, 12):
            c[(x, 0)] = color
        for y in range(1, 6):
            c[(3, y)] = color
            c[(12, y)] = color
        c[(3, 3)] = hi
    elif style == "ponytail":
        for x in range(4, 12):
            c[(x, 0)] = color
        for y in range(1, 7):
            c[(13, y)] = color
        c[(14, 4)] = color
    elif style == "bob":
        for x in range(4, 12):
            c[(x, 0)] = color
        for y in range(1, 5):
            c[(3, y)] = color
            c[(12, y)] = color
        c[(4, 4)] = hi
    elif style == "spiky":
        spikes = [4, 6, 7, 9, 11]
        for x in range(4, 12):
            c[(x, 1)] = color
        for x in spikes:
            c[(x, 0)] = hi if x in (6, 9) else color
    elif style == "bun":
        for x in range(6, 10):
            c[(x, 0)] = color
        for x in range(4, 12):
            c[(x, 1)] = color
    elif style == "cap":
        cc = cap_color or color
        cap_hi = lighten(cc, 0.25)
        for x in range(4, 12):
            c[(x, 0)] = cc
            c[(x, 1)] = cap_hi if x == 5 else cc
        for x in range(5, 11):
            c[(x, 2)] = cc
        for x in range(7, 12):
            c[(x, 3)] = cc  # brim, facing "down"
        for y in (3, 4):
            c[(4, y)] = color
            c[(11, y)] = color


def paint_accessory(c, accessory: str, headband_color=None):
    if accessory == "band":
        for x in range(5, 11):
            c[(x, 2)] = (214, 168, 84, 255)
    elif accessory == "glasses":
        frame = (40, 40, 44, 255)
        # Two small lenses with a visible skin-tone gap at the nose bridge,
        # instead of one solid bar (which reads as a blindfold, not glasses).
        c[(5, 3)] = frame
        c[(6, 3)] = frame
        c[(9, 3)] = frame
        c[(10, 3)] = frame
    elif accessory == "stubble":
        stub = (90, 68, 50, 255)
        for x in (5, 6, 9, 10):
            c[(x, 6)] = stub
    elif accessory == "headband":
        band = headband_color or (200, 120, 130, 255)
        for x in range(4, 12):
            c[(x, 2)] = band


def base_character(spec: dict, eyes: str):
    c = new_canvas()
    skin = spec["skin"]
    shirt = spec["shirt"]

    paint_block(c, 4, 0, 11, 6, skin, round_corners=True)  # head
    paint_block(c, 3, 8, 12, 12, shirt)  # torso
    paint_block(c, 0, 8, 2, 12, shirt)  # left sleeve
    paint_block(c, 13, 8, 15, 12, shirt)  # right sleeve
    c[(1, 12)] = skin  # left hand
    c[(14, 12)] = skin  # right hand
    paint_block(c, 4, 13, 6, 14, PANTS)  # left leg
    paint_block(c, 9, 13, 11, 14, PANTS)  # right leg
    c[(5, 15)] = SHOE
    c[(10, 15)] = SHOE
    for x in range(4, 12):
        c[(x, 15)] = DROP_SHADOW if (x, 15) not in c else c[(x, 15)]

    paint_hair(c, spec["hair"], spec["hair_color"], spec.get("cap_color"))
    if "accessory" in spec:
        paint_accessory(c, spec["accessory"], spec["shirt"])

    if eyes in ("both", "left"):
        c[(6, 4)] = EYE
    if eyes in ("both", "right"):
        c[(9, 4)] = EYE
    return c


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


def build_agent_frames(spec: dict):
    poses = {
        "down": base_character(spec, "both"),
        "up": base_character(spec, "none"),
        "left": base_character(spec, "left"),
        "right": base_character(spec, "right"),
    }
    frames = {}
    for direction, pose in poses.items():
        for i, (dx, dy) in enumerate(IDLE_OFFSETS):
            frames[f"idle_{direction}_{i}"] = render_frame(pose, dx, dy)
        for i, (dx, dy) in enumerate(WALK_OFFSETS):
            frames[f"walk_{direction}_{i}"] = render_frame(pose, dx, dy)
    return frames


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
            "app": "generate-agent-sprites.py",
            "image": os.path.basename(out_png),
            "format": "RGBA8888",
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1",
        },
    }
    with open(out_json, "w") as f:
        json.dump(atlas, f, indent=2)
    print(f"wrote {out_png} ({sheet_w}x{sheet_h}, {len(names)} frames)")


def main():
    for agent_id, spec in AGENTS.items():
        frames = build_agent_frames(spec)
        assert len(frames) == 24, f"{agent_id}: expected 24 frames, got {len(frames)}"
        pack_sheet(
            frames,
            cols=6,
            out_png=os.path.join(OUT_DIR, f"{agent_id}.png"),
            out_json=os.path.join(OUT_DIR, f"{agent_id}.json"),
        )


if __name__ == "__main__":
    main()
