import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ROSTER } from '@bharat-ai-office/shared';

// Every prop model this scene uses, from the CC0 Kenney Furniture Kit — see
// frontend/public/office-3d/props/SOURCE-README.md for license/provenance.
// Loaded once as templates; OfficeScene3D clones one per placement.
export const PROP_KEYS = [
  'desk',
  'chairDesk',
  'computerScreen',
  'computerKeyboard',
  'computerMouse',
  'bookcaseOpen',
  'books',
  'pottedPlant',
  'plantSmall1',
  'plantSmall2',
  'kitchenCoffeeMachine',
  'table',
  'rugRectangle',
  'rugRound',
  'trashcan',
  'lampRoundFloor',
  'sideTable',
] as const;

export type PropKey = (typeof PROP_KEYS)[number];

export interface Office3DAssets {
  /** One real 3D character model per agent, keyed by roster id (see assets-src/minecraft-characters). */
  characters: Record<string, THREE.Group>;
  /** One real CC0 furniture/prop model per key. */
  props: Record<PropKey, THREE.Group>;
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
    props: Object.fromEntries(propEntries) as Record<PropKey, THREE.Group>,
  };
}
