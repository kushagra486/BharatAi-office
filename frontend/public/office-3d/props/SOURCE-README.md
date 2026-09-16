# Office prop models — source & library

**Adding your own model?** See `../../../components/office-3d/propLibrary.ts`
— drop a `.glb` in this folder, add one entry there, and one placement in
`layout3d.ts`'s `DECOR_SPOTS`. Nothing else needs to change.

These 20 `.glb` files are furniture/prop models from Kenney's **Furniture Kit**
(https://kenney.nl/assets/furniture-kit), used unmodified.

- **License**: CC0 1.0 Universal (public domain) — https://creativecommons.org/publicdomain/zero/1.0/
- **Author**: Kenney (https://kenney.nl)
- Free for personal, educational, and commercial use. Attribution is not
  required by the license; this file exists purely for provenance.

Each model uses only flat PBR `baseColorFactor` materials — no external
textures — so they load standalone via `GLTFLoader` with no extra asset
dependencies. Real-world scale (meters); see `assets3d.ts` for how each is
positioned/scaled in the scene.

The room's walls are *not* one of these models — they're plain procedural
boxes built directly in `OfficeScene3D.ts` (`buildWalls()`), since the
kit's modular wall pieces need exact per-edge pivot/rotation alignment to
tile without gaps. A flat box in the same cream color reads identically at
this scale with zero alignment risk.

| File | What it is |
|---|---|
| `desk.glb` | Employee desk |
| `chairDesk.glb` | Office desk chair |
| `computerScreen.glb` / `computerKeyboard.glb` / `computerMouse.glb` | Desk computer setup |
| `bookcaseOpen.glb` / `books.glb` | Bookshelf + book stack decor |
| `pottedPlant.glb` / `plantSmall1.glb` / `plantSmall2.glb` | Office plants |
| `kitchenCoffeeMachine.glb` | Coffee machine |
| `table.glb` | Meeting/review table |
| `rugRectangle.glb` / `rugRound.glb` | Department-zone floor rugs |
| `trashcan.glb` | Trash can |
| `lampRoundFloor.glb` | Floor lamp |
| `lampWall.glb` | Wall light |
| `sideTable.glb` | Small side table (also the stand every appliance-on-a-table item rests on) |
| `kitchenMicrowave.glb` | Stand-in for "Printer" — no dedicated CC0 printer model was found; swap it for a real one any time via `propLibrary.ts` |
| `toaster.glb` | Stand-in for "Scanner" — same caveat as the printer above |
| `cabinetBed.glb` | Stand-in for "Locker" — same caveat |
