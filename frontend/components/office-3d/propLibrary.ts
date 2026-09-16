// The office's prop library — every decor item that can be dropped onto the
// floor, in one place. This is the extension point: to add your own item
// (a real printer/scanner/locker model instead of the shape-alike
// substitutes below, or anything else — a vending machine, a whiteboard,
// whatever fits your office):
//
//   1. Drop a .glb file into frontend/public/office-3d/props/<yourId>.glb
//      (flat PBR colors work best — no external textures needed, see
//      props/SOURCE-README.md for the format real props here use).
//   2. Add one entry to PROP_LIBRARY below.
//   3. Add one `{ col, row, libraryId }` entry to DECOR_SPOTS in
//      layout3d.ts to place it on the floor.
//
// Nothing else needs to change — OfficeScene3D.ts's buildDecor() reads this
// list generically, and assets3d.ts loads whatever file keys it references.

export interface LibraryProp {
  /** Matches the .glb filename (without extension) in public/office-3d/props/. */
  id: string;
  label: string;
  category: 'plant' | 'appliance' | 'storage' | 'lighting';
  /** Idle agents wander here on a break when true (see OfficeScene3D.ts's tickRoaming) — use this for things an agent would actually go use (coffee, printer), not pure decor (a plant, a wall light). */
  roamable: boolean;
  /** Multiplies OfficeScene3D.ts's scene-wide PROP_SCALE for this item only. Omit for the default size. */
  scaleMultiplier?: number;
  /** Another prop (by file id) this one rests on top of, e.g. a coffee machine standing on a side table. */
  standOn?: string;
  /** A second prop (by file id) placed just beside this one, e.g. a stack of books beside a bookshelf. */
  companion?: string;
  companionOffset?: { x: number; z: number };
}

export const PROP_LIBRARY: LibraryProp[] = [
  { id: 'pottedPlant', label: 'Potted Plant', category: 'plant', roamable: false, scaleMultiplier: 1.4 },
  { id: 'plantSmall1', label: 'Small Plant', category: 'plant', roamable: false, scaleMultiplier: 1.4 },
  { id: 'plantSmall2', label: 'Small Plant', category: 'plant', roamable: false, scaleMultiplier: 1.4 },
  { id: 'kitchenCoffeeMachine', label: 'Coffee Machine', category: 'appliance', roamable: true, standOn: 'sideTable' },
  // No dedicated CC0 printer/scanner/locker model was available in the
  // sourced pack (see props/SOURCE-README.md) — these reuse the
  // closest-shaped item from the same already-licensed kit as a stand-in.
  // Swap `id` for a real model via the steps above whenever you have one.
  { id: 'kitchenMicrowave', label: 'Printer', category: 'appliance', roamable: true, standOn: 'sideTable', scaleMultiplier: 0.85 },
  { id: 'toaster', label: 'Scanner', category: 'appliance', roamable: true, standOn: 'sideTable', scaleMultiplier: 0.75 },
  { id: 'cabinetBed', label: 'Locker', category: 'storage', roamable: false },
  { id: 'bookcaseOpen', label: 'Bookshelf', category: 'storage', roamable: false, companion: 'books', companionOffset: { x: 0.35, z: 0.15 } },
  { id: 'lampRoundFloor', label: 'Floor Lamp', category: 'lighting', roamable: false, companion: 'trashcan', companionOffset: { x: 0.4, z: 0 } },
  { id: 'lampWall', label: 'Wall Light', category: 'lighting', roamable: false },
];

/** Every distinct .glb this library (plus each entry's standOn/companion) needs loaded — the single source of truth assets3d.ts loads from. */
export const PROP_FILE_KEYS: string[] = Array.from(
  new Set(PROP_LIBRARY.flatMap((p) => [p.id, p.standOn, p.companion].filter((x): x is string => Boolean(x))))
);

export function findProp(id: string): LibraryProp | undefined {
  return PROP_LIBRARY.find((p) => p.id === id);
}
