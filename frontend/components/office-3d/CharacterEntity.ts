import * as THREE from 'three';
import type { Agent, TaskStatus } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import { agentColorHex } from '@/lib/agentColor';
import { providerColorHex } from '@/lib/providerColor';
import { cloneWithMaterials } from './assets3d';
import { badgeTexture, dotTexture } from './badgeTextures';

// The real per-agent 3D models (frontend/assets-src/minecraft-characters)
// are ~2.09 world units tall as exported. Scaled down so a standing
// character reads at a natural size next to the Kenney Furniture Kit's
// real-world-meter desks/chairs (a 0.384-tall desk should hit roughly
// knee/thigh height, not ankle height) — see layout3d.ts for the shared
// world scale this all sits in.
const CHARACTER_TARGET_HEIGHT = 1.6;
const SOURCE_MODEL_HEIGHT = 2.09;
export const CHARACTER_SCALE = CHARACTER_TARGET_HEIGHT / SOURCE_MODEL_HEIGHT;

const PULSE_SPEED = 0.09;
const TURN_SPEED = 10; // radians/sec-ish smoothing factor for facing rotation

export class CharacterEntity {
  readonly agent: Agent;
  readonly root = new THREE.Group();

  private readonly model: THREE.Object3D;
  private readonly statusDot: THREE.Sprite;
  private readonly providerDot: THREE.Sprite;
  private targetYaw = 0;
  private pulseT = 0;
  private status: TaskStatus = 'idle';

  constructor(agent: Agent, template: THREE.Group) {
    this.agent = agent;
    const identityColor = new THREE.Color(agentColorHex(agent.color));

    this.model = cloneWithMaterials(template);
    this.model.scale.setScalar(CHARACTER_SCALE);
    this.root.add(this.model);

    // A flat identity-color ring at the character's feet — the 3D
    // equivalent of the portrait ring / avatar border used elsewhere in the
    // app, since the real character models are already fully colored and
    // don't need (or want) a tint.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 24),
      new THREE.MeshBasicMaterial({ color: identityColor, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    this.root.add(ring);

    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: badgeTexture(agent.shape), color: identityColor, depthTest: false })
    );
    badge.scale.set(0.34, 0.34, 1);
    badge.position.set(0.34, CHARACTER_TARGET_HEIGHT + 0.5, 0);
    this.root.add(badge);

    this.statusDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false }));
    this.statusDot.scale.set(0.22, 0.22, 1);
    this.statusDot.position.set(-0.32, CHARACTER_TARGET_HEIGHT + 0.5, 0);
    this.root.add(this.statusDot);

    // Which LLM provider this agent's current model call is routed
    // through — a glanceable color across the whole floor (see
    // lib/providerColor.ts); full provider/model/token detail is one click
    // away in the employee side panel. Hidden until a real call has been
    // recorded for this agent (no usage row yet == nothing to show).
    this.providerDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), depthTest: false, transparent: true, opacity: 0 }));
    this.providerDot.scale.set(0.16, 0.16, 1);
    this.providerDot.position.set(0, CHARACTER_TARGET_HEIGHT + 0.72, 0);
    this.root.add(this.providerDot);

    this.setStatus('idle');
  }

  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  setStatus(status: TaskStatus): void {
    this.status = status;
    const dot = this.statusDot.material as THREE.SpriteMaterial;
    dot.color.set(STATUS_COLOR[status]);
    this.pulseT = 0;
    this.statusDot.scale.set(0.22, 0.22, 1);
  }

  /** Updates the small provider-color badge above the character's head. `undefined` (no usage recorded yet for this agent) keeps it hidden rather than showing a misleading default color. */
  setProvider(provider: string | undefined): void {
    const material = this.providerDot.material as THREE.SpriteMaterial;
    material.opacity = provider ? 0.95 : 0;
    if (provider) material.color.set(providerColorHex(provider));
  }

  /** Sets the direction the character should face, in radians (atan2(dx, dz) convention — see OfficeScene3D.directionYaw). Smoothly turns toward it each tick rather than snapping. */
  setFacing(yaw: number): void {
    this.targetYaw = yaw;
  }

  /** Advances the facing turn and status-dot pulse. Called once/tick from OfficeScene3D. */
  update(deltaSeconds: number): void {
    let delta = this.targetYaw - this.model.rotation.y;
    delta = ((delta + Math.PI) % (Math.PI * 2)) - Math.PI; // shortest-path wrap
    const step = Math.min(Math.abs(delta), TURN_SPEED * deltaSeconds) * Math.sign(delta);
    this.model.rotation.y += step;

    if (this.status === 'working' || this.status === 'blocked') {
      this.pulseT += deltaSeconds * PULSE_SPEED * 60;
      const scale = 0.22 * (1 + Math.sin(this.pulseT) * 0.3);
      this.statusDot.scale.set(scale, scale, 1);
    }
  }

  destroy(): void {
    this.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}
