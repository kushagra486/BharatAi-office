import * as THREE from 'three';

/**
 * Wraps a cloned model in a pivot Group re-centered so the model sits
 * horizontally centered and resting on y=0 — the Kenney Furniture Kit's
 * models each use their own corner/edge pivot convention (some centered,
 * some corner-anchored — see the bounding boxes noted while sourcing
 * props/SOURCE-README.md), so every placement call in OfficeScene3D would
 * otherwise need its own hand-measured offset. Callers just position the
 * returned group at the desired world tile center.
 */
export function centerOnFloor(object: THREE.Object3D, scale = 1): THREE.Group {
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  const wrapper = new THREE.Group();
  wrapper.add(object);
  return wrapper;
}

/** Height of a (already floor-centered) object's top surface — e.g. to stack a monitor on a desk. */
export function topY(object: THREE.Object3D): number {
  return new THREE.Box3().setFromObject(object).max.y;
}
