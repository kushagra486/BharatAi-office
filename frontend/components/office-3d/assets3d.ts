import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ROSTER } from '@bharat-ai-office/shared';
import { PROP_FILE_KEYS } from './propLibrary';

// The desk/table/rug models every employee cluster and the review table
// need, regardless of what's in the (user-extensible) prop library — see
// propLibrary.ts for the decor items that ARE library-driven.
const STRUCTURAL_PROP_KEYS = ['desk', 'chairDesk', 'computerScreen', 'computerKeyboard', 'computerMouse', 'table', 'rugRectangle', 'rugRound'];

// Every .glb this scene needs, from the CC0 Kenney Furniture Kit plus
// whatever's been added to the prop library — see
// frontend/public/office-3d/props/SOURCE-README.md for license/provenance.
// Loaded once as templates; OfficeScene3D clones one per placement.
export const PROP_KEYS = Array.from(new Set([...STRUCTURAL_PROP_KEYS, ...PROP_FILE_KEYS]));

export interface Office3DAssets {
  /** One real 3D character model per agent, keyed by roster id (see assets-src/minecraft-characters). */
  characters: Record<string, THREE.Group>;
  /** One real CC0 furniture/prop model per key (structural + prop-library items). */
  props: Record<string, THREE.Group>;
}

const loader = new GLTFLoader();

function loadModel(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        resolve(root);
      },
      undefined,
      reject
    );
  });
}

/** Deep-clones an object graph AND its materials (Object3D.clone() shares materials by reference, which would let recoloring one instance — e.g. a department rug — corrupt every other clone). */
export function cloneWithMaterials(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);
  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    }
  });
  return clone;
}

export async function loadOffice3DAssets(): Promise<Office3DAssets> {
  const characterEntries = await Promise.all(
    ROSTER.map(async (agent) => [agent.id, await loadModel(`/office-3d/characters/${agent.id}.glb`)] as const)
  );
  const propEntries = await Promise.all(
    PROP_KEYS.map(async (key) => [key, await loadModel(`/office-3d/props/${key}.glb`)] as const)
  );

  return {
    characters: Object.fromEntries(characterEntries),
    props: Object.fromEntries(propEntries),
  };
}
