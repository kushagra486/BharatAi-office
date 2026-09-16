# Bharat AI — Minecraft-Style 3D Character Models

12 blocky, Minecraft/voxel-style character models built on the standard
Steve-style rig (head, torso, 2 arms, 2 legs), colored to match the
2D reference images supplied.

Each character folder contains:
- `<name>.glb` — ready to drag into Blender, Unity, Unreal, Godot, three.js, etc.
- `<name>.obj` — universal format with embedded vertex colors (also readable in Blender/MeshLab)

## Characters
| # | Folder | Character |
|---|--------|-----------|
| 1 | 01_nova | Evelyn Vance |
| 2 | 02_kael | Delvin Marion |
| 3 | 03_priya | Priya Nair |
| 4 | 04_devraj | Marcus Brondt |
| 5 | 05_simran | Sophia Chen |
| 6 | 06_arjun | Caleb Cross |
| 7 | 07_meera | Grace Miller |
| 8 | 08_raghav | Caleb Cross (2nd panel) |
| 9 | 09_tanya | Tariq Al-Mansoor |
| 10 | 10_farhan | Devon Reed |
| 11 | 11_isha | Chloe Bennett |
| 12 | 12_arthur | Arthur Sterling |

## Notes / limitations
- The source reference pack only contained a **front view** for each
  character (side/back/top were explicitly placeholders, per the pack's
  own README). Full bodies, back-of-hair detail, and side profiles were
  therefore built using standard humanoid proportions rather than traced
  geometry.
- Colors (skin tone, hair, hair silhouette, clothing, and key accents like
  ties/sashes/headsets/glasses) were matched by eye to each reference image.
- Materials are flat solid colors per body part (no photographic texture
  mapping), which keeps the models lightweight and easy to recolor/edit
  in Blender if you want to refine any character further.
- Scale: 1 unit = 1 meter, standard Minecraft player proportions (~2 units tall).

If you'd like closer likeness (e.g. actual UV-textured skins, or more
detailed hairstyles/accessories per character), let me know which ones
to refine and I can iterate.
