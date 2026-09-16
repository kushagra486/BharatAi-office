#!/usr/bin/env python3
"""
Generates distinct per-agent character sprite sheets:
  frontend/public/office-pixel/characters/<agentId>.png + .json

Unlike generate-pixel-art.py's shared grayscale rig (recolored at runtime
via `.tint`), each agent here gets its own full-color sheet with a
distinct head accessory/hairstyle silhouette — not just a different hue
on the same shape — so all 11 read as different characters at a glance.
Body/torso/arm/leg proportions stay identical across agents (same
"office worker" species, same rig `generate-pixel-art.py` uses); only
the head accessory and base hue vary per agent. Every pixel is placed
explicitly; nothing traced or generated from a reference image or stock
asset. See ASSETS.md "Per-agent custom sprites" for the exact contract
this output must satisfy (24 frame keys, 32x32 per frame, untinted full
color, transparent background).

Run: python3 frontend/scripts/generate-agent-sprites.py (requires Pillow)
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
OUTLINE = (24, 24, 28, 255)
FACE = (16, 16, 20, 255)
DROP_SHADOW = (10, 10, 10, 70)
HAIR_DARK = (40, 40, 48, 255)
HAIR_DARK2 = (58, 58, 68, 255)
METAL = (176, 184, 196, 255)
METAL_DARK = (112, 120, 132, 255)
LENS = (22, 27, 36, 255)
LENS_HL = (130, 205, 255, 255)
GOLD = (255, 210, 90, 255)
WHITE = (255, 255, 255, 255)

# Body layout on the 16x16 grid — identical for every agent so they read as
# the same "species" of office worker; only the head accessory + hue vary.
# (Shifted 1px down from generate-pixel-art.py's shared rig vs. the old
# per-agent pack, freeing rows 0-1 as headroom for a hat/hair silhouette.)
HEAD = (4, 2, 11, 7)
TORSO = (3, 9, 12, 13)
ARM_L = (0, 9, 2, 13)
ARM_R = (13, 9, 15, 13)
LEG_L = (4, 14, 6, 14)
LEG_R = (9, 14, 11, 14)


def shade(base, mix_white=0.0, mix_black=0.0):
    r, g, b = base
    if mix_white:
        r += (255 - r) * mix_white
        g += (255 - g) * mix_white
        b += (255 - b) * mix_white
    if mix_black:
        r *= 1 - mix_black
        g *= 1 - mix_black
        b *= 1 - mix_black
    return (int(r), int(g), int(b), 255)


def paint_block(canvas, box, base):
    """Same hard-edged block primitive as generate-pixel-art.py's paint_block,
    but shaded directly from `base` (an (r,g,b) tuple) instead of a grayscale
    role, since these sheets are baked full-color rather than tint-multiplied
    at runtime."""
    x0, y0, x1, y1 = box
    highlight = shade(base, mix_white=0.45)
    shadow = shade(base, mix_black=0.35)
    width = x1 - x0 + 1
    height = y1 - y0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            on_v_edge = x in (x0, x1)
            on_h_edge = height >= 3 and y in (y0, y1)
            if on_v_edge or on_h_edge:
                canvas[(x, y)] = OUTLINE
            elif width >= 6 and x == x0 + 1:
                canvas[(x, y)] = highlight
            elif width >= 6 and x == x1 - 1:
                canvas[(x, y)] = shadow
            else:
                canvas[(x, y)] = (*base, 255)


# --- per-agent head accessories — the actual "not just recolored" signal ---
# Each paints directly into rows 0-1 (headroom above the head block) and
# sometimes a strap/band across the head's eye row (y=5); eyes are always
# painted last in base_character() so the facing cue still reads through.


def hat_hardhat(c):  # kael — Solutions Architect
    for x in range(4, 12):
        c[(x, 1)] = METAL
    for x in range(3, 13):
        c[(x, 2)] = METAL
    c[(3, 2)] = METAL_DARK
    c[(12, 2)] = METAL_DARK
    for x in range(5, 11):
        c[(x, 0)] = METAL_DARK


def glasses_shorthair(c):  # priya — Backend Developer
    for x in range(4, 12):
        c[(x, 1)] = HAIR_DARK
    for x in range(4, 12):
        c[(x, 2)] = HAIR_DARK2
    for x in range(4, 12):
        c[(x, 5)] = LENS
    c[(6, 5)] = LENS_HL
    c[(9, 5)] = LENS_HL


def spiky_hair(c):  # devraj — Frontend Developer
    for x in (4, 7, 10):
        c[(x, 0)] = HAIR_DARK2
    for x in range(4, 12):
        c[(x, 1)] = HAIR_DARK


def beret(c):  # simran — UI/UX Designer
    for x in range(3, 12):
        c[(x, 1)] = HAIR_DARK2
    for x in range(4, 11):
        c[(x, 0)] = HAIR_DARK2
    c[(11, 0)] = HAIR_DARK
    c[(3, 1)] = HAIR_DARK


def goggles(c):  # arjun — QA Engineer: two round lenses + a nose-bridge gap, not a solid band
    c[(2, 4)] = METAL_DARK
    c[(13, 4)] = METAL_DARK
    for x in (5, 6):
        c[(x, 4)] = METAL_DARK
        c[(x, 5)] = LENS
    for x in (9, 10):
        c[(x, 4)] = METAL_DARK
        c[(x, 5)] = LENS
    c[(5, 5)] = LENS_HL
    c[(10, 5)] = LENS_HL
    # x=7,8 (the bridge) stay the head's own color — that gap is what reads as goggles, not a mask


def ponytail(c):  # meera — Data/Analytics
    for x in range(5, 10):
        c[(x, 1)] = HAIR_DARK
    for y in range(2, 5):
        c[(12, y)] = HAIR_DARK
        c[(13, y)] = HAIR_DARK2


def visor_mask(c):  # raghav — Security Reviewer: one solid opaque band (no lens gap) — a mask, not eyewear
    for x in range(2, 14):
        c[(x, 4)] = HAIR_DARK
    c[(2, 3)] = HAIR_DARK
    c[(13, 3)] = HAIR_DARK
    for x in range(3, 13):
        c[(x, 5)] = HAIR_DARK2


def bun_pen(c):  # tanya — Technical Writer
    for x in range(6, 10):
        c[(x, 0)] = HAIR_DARK
    for x in range(5, 11):
        c[(x, 1)] = HAIR_DARK2
    c[(13, 9)] = GOLD
    c[(14, 10)] = GOLD


def cap_brim(c):  # farhan — DevOps Engineer
    for x in range(4, 12):
        c[(x, 1)] = HAIR_DARK2
    for x in range(5, 11):
        c[(x, 0)] = HAIR_DARK2
    for x in range(11, 14):
        c[(x, 2)] = HAIR_DARK


def headset(c):  # isha — Project Coordinator
    for x in range(4, 12):
        c[(x, 0)] = METAL_DARK
    c[(3, 1)] = METAL_DARK
    c[(3, 2)] = METAL_DARK
    c[(3, 3)] = METAL
    c[(12, 1)] = METAL_DARK
    c[(3, 4)] = METAL
    c[(4, 5)] = METAL


def core_diamond(c):  # nova — Orchestrator: a floating core, not a hairstyle
    c[(7, 0)] = GOLD
    c[(8, 0)] = GOLD
    c[(6, 1)] = GOLD
    c[(7, 1)] = WHITE
    c[(8, 1)] = WHITE
    c[(9, 1)] = GOLD


AGENTS = {
    "nova": {"color": (139, 124, 246), "hair": core_diamond},
    "kael": {"color": (255, 77, 77), "hair": hat_hardhat},
    "priya": {"color": (255, 148, 51), "hair": glasses_shorthair},
    "devraj": {"color": (255, 210, 63), "hair": spiky_hair},
    "simran": {"color": (168, 230, 46), "hair": beret},
    "arjun": {"color": (46, 204, 113), "hair": goggles},
    "meera": {"color": (47, 230, 210), "hair": ponytail},
    "raghav": {"color": (56, 189, 248), "hair": visor_mask},
    "tanya": {"color": (91, 127, 255), "hair": bun_pen},
    "farhan": {"color": (255, 79, 195), "hair": cap_brim},
    "isha": {"color": (255, 77, 121), "hair": headset},
}


def base_character(base_color, hair_fn, eyes):
    """eyes: 'both' | 'none' | 'left' | 'right' — same direction convention
    as generate-pixel-art.py. hair_fn runs before eyes so the facing cue
    always shows through any accessory drawn across the eye row."""
    c = {}
    paint_block(c, TORSO, base_color)
    paint_block(c, ARM_L, base_color)
    paint_block(c, ARM_R, base_color)
    paint_block(c, LEG_L, base_color)
    paint_block(c, LEG_R, base_color)
    paint_block(c, HEAD, base_color)
    hair_fn(c)
    if eyes in ("both", "left"):
        c[(6, 5)] = FACE
    if eyes in ("both", "right"):
        c[(9, 5)] = FACE
    for x in range(4, 12):
        c[(x, 15)] = DROP_SHADOW
    return c


IDLE_OFFSETS = [(0, 0), (0, -1)]
WALK_OFFSETS = [(0, 0), (-1, -1), (0, 0), (1, -1)]


def render_frame(pose, dx, dy):
    img = Image.new("RGBA", (LOGICAL, LOGICAL), TRANSPARENT)
    px = img.load()
    for (x, y), color in pose.items():
        nx, ny = x + dx, y + dy
        if 0 <= nx < LOGICAL and 0 <= ny < LOGICAL:
            px[nx, ny] = color
    return img.resize((FRAME, FRAME), Image.NEAREST)


def build_agent_frames(base_color, hair_fn):
    poses = {
        "down": base_character(base_color, hair_fn, "both"),
        "up": base_character(base_color, hair_fn, "none"),
        "left": base_character(base_color, hair_fn, "left"),
        "right": base_character(base_color, hair_fn, "right"),
    }
    frames = {}
    for direction, pose in poses.items():
        for i, (dx, dy) in enumerate(IDLE_OFFSETS):
            frames[f"idle_{direction}_{i}"] = render_frame(pose, dx, dy)
        for i, (dx, dy) in enumerate(WALK_OFFSETS):
            frames[f"walk_{direction}_{i}"] = render_frame(pose, dx, dy)
    return frames


def pack_sheet(frames, cols, out_png, out_json):
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
    for agent_id, cfg in AGENTS.items():
        frames = build_agent_frames(cfg["color"], cfg["hair"])
        assert len(frames) == 24, f"{agent_id}: expected 24 frames, got {len(frames)}"
        pack_sheet(
            frames,
            cols=6,
            out_png=os.path.join(OUT_DIR, f"{agent_id}.png"),
            out_json=os.path.join(OUT_DIR, f"{agent_id}.json"),
        )


if __name__ == "__main__":
    main()
