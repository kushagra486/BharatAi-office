import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Agent, MessageType, TaskStatus } from '@bharat-ai-office/shared';
import { EMPLOYEE_ROSTER, MESSAGE_COLOR } from '@bharat-ai-office/shared';
import type { Office3DAssets } from './assets3d';
import { cloneWithMaterials } from './assets3d';
import { CharacterEntity } from './CharacterEntity';
import { dotTexture } from './badgeTextures';
import { findProp, type LibraryProp } from './propLibrary';
import { centerOnFloor, topY } from './sceneUtils';
import {
  BREAK_SPOTS,
  DECOR_SPOTS,
  GRID_COLS,
  GRID_ROWS,
  NOVA_DOOR_COLS,
  NOVA_WALL_COL_RANGE,
  NOVA_WALL_COLS,
  NOVA_WALL_ROW,
  REVIEW_TABLE_WORLD,
  WINDOW_COLS,
  rugColorFor,
  tileToWorld,
  toWorld,
  type PercentPoint,
  type WorldPoint,
} from './layout3d';

const WALK_LEG_MS = 1400;
const DWELL_MS = 400;
const ENVELOPE_FLIGHT_MS = 1600;
const ROAM_DWELL_MS = 1400;
const ROAM_MIN_INTERVAL_MS = 4500;
const ROAM_MAX_INTERVAL_MS = 9000;

const WALL_HEIGHT = 2.4;
const WALL_THICKNESS = 0.12;
const WALL_COLOR = 0xebe6d8;
const WALL_TRIM_COLOR = 0xc4ba9e;
const WINDOW_COLOR = 0xa9cddb;
const FLOOR_A = 0x96ad8a;
const FLOOR_B = 0x8ba37f;
const FLOOR_DOT = 0x86a07a;

// Every furniture/prop model (desk, chair, plants, etc.) is scaled up by
// this factor so it reads clearly at a glance instead of looking tiny next
// to the (also enlarged — see CharacterEntity.ts) character models.
const PROP_SCALE = 1.7;

// Half-height of the orthographic view frustum — real 3D geometry (true
// depth, lighting, shadows) rendered with NO perspective distortion, so
// distance from the camera no longer shrinks objects. This is what gives a
// true-3D scene the flat, consistent-scale read of a 2D top-down game.
const ORTHO_VIEW_SIZE = 9.5;

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: WorldPoint, b: WorldPoint, t: number): WorldPoint {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/** three.js Y-rotation that makes an object's local +Z axis point from `from` toward `to`. */
function yawTo(from: WorldPoint, to: WorldPoint): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

interface WalkState {
  phase: 'toTarget' | 'atTarget' | 'toHome';
  elapsedMs: number;
  homePos: WorldPoint;
  targetPos: WorldPoint;
  dwellMs: number;
  yaw: number;
}

interface EnvelopeState {
  sprite: THREE.Sprite;
  fromPos: WorldPoint;
  toPos: WorldPoint;
  elapsedMs: number;
}

export class OfficeScene3D {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly controls: OrbitControls;

  private characters = new Map<string, CharacterEntity>();
  private charactersLayer = new THREE.Group();
  private effectsLayer = new THREE.Group();
  private walkStates = new Map<string, WalkState>();
  private envelopes: EnvelopeState[] = [];
  private statuses = new Map<string, TaskStatus>();
  private roamElapsedMs = 0;
  private nextRoamAtMs = ROAM_MIN_INTERVAL_MS + Math.random() * (ROAM_MAX_INTERVAL_MS - ROAM_MIN_INTERVAL_MS);
  private ambientT = 0;
  private novaGlowMesh: THREE.Mesh | null = null;
  private novaLight: THREE.PointLight | null = null;
  private wireLines: THREE.Line[] = [];
  private wirePhase = 0;
  private raycaster = new THREE.Raycaster();

  constructor(
    private assets: Office3DAssets,
    private agents: Agent[],
    private onSelectAgent: (agentId: string) => void,
    canvas: HTMLCanvasElement
  ) {
    this.scene.background = new THREE.Color(0xebe6d8);
    this.scene.fog = new THREE.Fog(0xebe6d8, 30, 50);

    this.camera = new THREE.OrthographicCamera(-ORTHO_VIEW_SIZE, ORTHO_VIEW_SIZE, ORTHO_VIEW_SIZE, -ORTHO_VIEW_SIZE, 0.1, 100);
    this.camera.position.set(0, 15.5, 12.5);
    this.camera.lookAt(0, 0.4, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.4, 0);
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 2.2;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    this.buildLights();
    this.buildFloor();
    this.buildWalls();
    this.buildDeskClusters();
    this.buildReviewTable();
    this.buildDecor();
    this.buildWires();

    this.scene.add(this.charactersLayer, this.effectsLayer);
    for (const agent of this.agents) {
      const template = this.assets.characters[agent.id];
      if (!template) continue;
      const entity = new CharacterEntity(agent, template);
      const pos = toWorld({ x: agent.home_x, y: agent.home_y });
      entity.setPosition(pos.x, pos.z);
      entity.setFacing(0);
      entity.root.userData.agentId = agent.id;
      this.charactersLayer.add(entity.root);
      this.characters.set(agent.id, entity);
    }

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.pointerCanvas = canvas;
  }

  private pointerCanvas: HTMLCanvasElement;

  private handlePointerDown = (ev: PointerEvent): void => {
    const rect = this.pointerCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.charactersLayer.children, true);
    if (hits.length === 0) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.agentId) obj = obj.parent;
    if (obj) this.onSelectAgent(obj.userData.agentId as string);
  };

  setAspect(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.left = -ORTHO_VIEW_SIZE * aspect;
    this.camera.right = ORTHO_VIEW_SIZE * aspect;
    this.camera.top = ORTHO_VIEW_SIZE;
    this.camera.bottom = -ORTHO_VIEW_SIZE;
    this.camera.updateProjectionMatrix();
  }

  setAgentStatus(agentId: string, status: TaskStatus): void {
    this.statuses.set(agentId, status);
    this.characters.get(agentId)?.setStatus(status);
  }

  walkAgentToReviewTable(agentId: string, homePct: PercentPoint): void {
    this.startWalk(agentId, toWorld(homePct), REVIEW_TABLE_WORLD, DWELL_MS);
  }

  spawnEnvelope(fromPct: PercentPoint, toPct: PercentPoint, messageType: MessageType): void {
    const color = new THREE.Color(MESSAGE_COLOR[messageType]);
    const material = new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.42, 0.42, 1);
    const fromPos = toWorld(fromPct);
    sprite.position.set(fromPos.x, 0.9, fromPos.z);
    this.effectsLayer.add(sprite);
    this.envelopes.push({ sprite, fromPos, toPos: toWorld(toPct), elapsedMs: 0 });
  }

  /** Advances all animation state. Call once per frame before rendering; does not render itself (see OfficeFloor3D.tsx's loop). */
  tick(deltaMS: number): void {
    const deltaSeconds = deltaMS / 1000;
    this.controls.update();
    for (const character of this.characters.values()) character.update(deltaSeconds);
    this.tickWalks(deltaMS);
    this.tickEnvelopes(deltaMS);
    this.tickRoaming(deltaMS);
    this.tickAmbient(deltaMS);
    this.tickWires(deltaMS);
  }

  destroy(): void {
    this.pointerCanvas.removeEventListener('pointerdown', this.handlePointerDown);
    for (const character of this.characters.values()) character.destroy();
    this.characters.clear();
    this.controls.dispose();
  }

  // --- construction -----------------------------------------------------

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xfff7e6, 0x6b8f5e, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d8, 1.15);
    sun.position.set(10, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
  }

  private buildFloor(): void {
    const cell = 32;
    const canvas = document.createElement('canvas');
    canvas.width = GRID_COLS * cell;
    canvas.height = GRID_ROWS * cell;
    const ctx = canvas.getContext('2d')!;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? `#${FLOOR_A.toString(16)}` : `#${FLOOR_B.toString(16)}`;
        ctx.fillRect(col * cell, row * cell, cell, cell);
      }
    }
    ctx.fillStyle = `#${FLOOR_DOT.toString(16)}`;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if ((row * 7 + col * 13) % 11 === 0) {
          ctx.fillRect(col * cell + cell * 0.35, row * cell + cell * 0.35, cell * 0.16, cell * 0.16);
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_COLS, GRID_ROWS),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /** Perimeter walls on 3 sides (back + left + right) — the near/front side facing the camera is left open, dollhouse-style, so the interior is never occluded. Nova's small partitioned office reuses the same box-wall approach. */
  private buildWalls(): void {
    const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.9 });
    const windowMat = new THREE.MeshStandardMaterial({ color: WINDOW_COLOR, roughness: 0.3, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: WALL_TRIM_COLOR, roughness: 0.9 });

    const addWallBox = (
      centerX: number,
      centerZ: number,
      lengthX: number,
      lengthZ: number,
      material: THREE.Material
    ): void => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(lengthX, WALL_HEIGHT, lengthZ), material);
      box.position.set(centerX, WALL_HEIGHT / 2, centerZ);
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);

      const skirt = new THREE.Mesh(new THREE.BoxGeometry(lengthX + 0.02, 0.14, lengthZ + 0.02), trimMat);
      skirt.position.set(centerX, 0.07, centerZ);
      this.scene.add(skirt);
    };

    // Back wall (row 0), with window insets.
    for (let col = 0; col < GRID_COLS; col++) {
      const t = tileToWorld(col, 0);
      addWallBox(t.x, t.z - 0.5, 1, WALL_THICKNESS, WINDOW_COLS.has(col) ? windowMat : wallMat);
    }
    // Left + right walls.
    for (let row = 0; row < GRID_ROWS; row++) {
      const left = tileToWorld(0, row);
      addWallBox(left.x - 0.5, left.z, WALL_THICKNESS, 1, wallMat);
      const right = tileToWorld(GRID_COLS - 1, row);
      addWallBox(right.x + 0.5, right.z, WALL_THICKNESS, 1, wallMat);
    }

    // Nova's small enclosed office: side walls flanking rows 1-3, a front
    // wall at NOVA_WALL_ROW with a door gap — same footprint as the 2D scene.
    for (const col of NOVA_WALL_COLS) {
      const top = tileToWorld(col, 1);
      const bottom = tileToWorld(col, NOVA_WALL_ROW - 1);
      const centerZ = (top.z - 0.5 + bottom.z + 0.5) / 2;
      addWallBox(top.x, centerZ, WALL_THICKNESS, bottom.z + 0.5 - (top.z - 0.5), wallMat);
    }
    for (let col = NOVA_WALL_COL_RANGE.min; col <= NOVA_WALL_COL_RANGE.max; col++) {
      if (NOVA_DOOR_COLS.has(col)) continue;
      const t = tileToWorld(col, NOVA_WALL_ROW);
      addWallBox(t.x, t.z, 1, WALL_THICKNESS, wallMat);
    }
  }

  private buildDeskClusters(): void {
    for (const agent of this.agents) {
      const pos = toWorld({ x: agent.home_x, y: agent.home_y });
      this.buildOneDesk(agent, pos, agent.id === 'nova');
    }
  }

  private buildOneDesk(agent: Agent, pos: WorldPoint, isNova: boolean): void {
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    this.scene.add(group);

    const rugColor = isNova ? 0xd6a854 : rugColorFor(agent);
    if (rugColor !== null) {
      const rug = centerOnFloor(cloneWithMaterials(this.assets.props.rugRectangle), PROP_SCALE);
      rug.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat.name === 'carpet') mat.color.set(rugColor);
          if (mat.name === 'carpetDarker') mat.color.set(rugColor).multiplyScalar(0.85);
        }
      });
      rug.scale.multiply(new THREE.Vector3(1.15, 1, 1.4));
      rug.position.y = 0.005;
      group.add(rug);
    }

    const deskTemplate = isNova ? this.assets.props.table : this.assets.props.desk;
    const desk = centerOnFloor(cloneWithMaterials(deskTemplate), PROP_SCALE);
    desk.position.z = -0.15 * PROP_SCALE;
    group.add(desk);
    const deskTop = topY(desk);

    const screen = centerOnFloor(cloneWithMaterials(this.assets.props.computerScreen), PROP_SCALE * 0.72);
    screen.position.set(0, deskTop, -0.28 * PROP_SCALE);
    screen.rotation.y = Math.PI;
    group.add(screen);

    const keyboard = centerOnFloor(cloneWithMaterials(this.assets.props.computerKeyboard), PROP_SCALE);
    keyboard.position.set(-0.08 * PROP_SCALE, deskTop, 0.02 * PROP_SCALE);
    group.add(keyboard);

    const mouse = centerOnFloor(cloneWithMaterials(this.assets.props.computerMouse), PROP_SCALE);
    mouse.position.set(0.22 * PROP_SCALE, deskTop, 0.02 * PROP_SCALE);
    group.add(mouse);

    const chair = centerOnFloor(cloneWithMaterials(this.assets.props.chairDesk), PROP_SCALE);
    chair.rotation.y = Math.PI;
    chair.position.set(0, 0, 0.55 * PROP_SCALE);
    group.add(chair);
  }

  private buildReviewTable(): void {
    const group = new THREE.Group();
    group.position.set(REVIEW_TABLE_WORLD.x, 0, REVIEW_TABLE_WORLD.z);
    this.scene.add(group);

    const table = centerOnFloor(cloneWithMaterials(this.assets.props.table), PROP_SCALE * 1.3);
    group.add(table);

    const rug = centerOnFloor(cloneWithMaterials(this.assets.props.rugRound), PROP_SCALE * 1.6);
    rug.position.y = 0.005;
    group.add(rug);

    const seatOffsets: [number, number][] = [
      [-0.9, 0],
      [0.9, 0],
      [0, -0.65],
      [0, 0.65],
    ];
    for (const [dx, dz] of seatOffsets) {
      const chair = centerOnFloor(cloneWithMaterials(this.assets.props.chairDesk), PROP_SCALE);
      chair.position.set(dx * PROP_SCALE, 0, dz * PROP_SCALE);
      chair.rotation.y = Math.atan2(-dx, -dz);
      group.add(chair);
    }
  }

  private buildDecor(): void {
    for (const spot of DECOR_SPOTS) {
      const entry = findProp(spot.libraryId);
      if (!entry) continue; // library entry removed/renamed without updating DECOR_SPOTS — skip rather than crash
      this.placeLibraryProp(entry, tileToWorld(spot.col, spot.row));
    }

    // Nova's ambient glow — a soft gold disc + a matching pulsing point light,
    // the 3D equivalent of pixiScene.ts's novaAura.
    const nova = this.agents.find((a) => a.id === 'nova');
    if (nova) {
      const pos = toWorld({ x: nova.home_x, y: nova.home_y });
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(2.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xd6a854, transparent: true, opacity: 0.22, depthWrite: false })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(pos.x, 0.01, pos.z);
      this.scene.add(glow);
      this.novaGlowMesh = glow;

      const light = new THREE.PointLight(0xd6a854, 1.4, 9, 2);
      light.position.set(pos.x, 2.2, pos.z);
      this.scene.add(light);
      this.novaLight = light;
    }
  }

  /** Places one prop-library entry (propLibrary.ts) at a world position — reads `standOn`/`companion` generically so adding a new library item never needs a new case here. */
  private placeLibraryProp(entry: LibraryProp, pos: WorldPoint): void {
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    this.scene.add(group);

    let restingY = 0;
    if (entry.standOn) {
      const stand = centerOnFloor(cloneWithMaterials(this.assets.props[entry.standOn]), PROP_SCALE);
      group.add(stand);
      restingY = topY(stand);
    }

    const main = centerOnFloor(cloneWithMaterials(this.assets.props[entry.id]), PROP_SCALE * (entry.scaleMultiplier ?? 1));
    main.position.y = restingY;
    group.add(main);

    if (entry.companion) {
      const companion = centerOnFloor(cloneWithMaterials(this.assets.props[entry.companion]), PROP_SCALE);
      const offset = entry.companionOffset ?? { x: 0.35, z: 0.15 };
      companion.position.set(offset.x * PROP_SCALE, 0, offset.z * PROP_SCALE);
      group.add(companion);
    }
  }

  private buildWires(): void {
    const material = new THREE.LineDashedMaterial({ color: 0x6b5f48, dashSize: 0.18, gapSize: 0.22, transparent: true, opacity: 0.45 });
    for (const agent of EMPLOYEE_ROSTER) {
      const from = toWorld({ x: agent.home_x, y: agent.home_y });
      const points = [new THREE.Vector3(from.x, 0.02, from.z), new THREE.Vector3(REVIEW_TABLE_WORLD.x, 0.02, REVIEW_TABLE_WORLD.z)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      // Stash the original (unshifted) per-vertex line distances — three@0.160's
      // LineDashedMaterial has no `dashOffset` uniform to animate, so the
      // "marching ants" flow effect instead comes from re-writing this
      // attribute's values by a growing phase each tick (tickWires).
      const distances = geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
      line.userData.baseDistances = distances.array.slice();
      this.scene.add(line);
      this.wireLines.push(line);
    }
  }

  // --- per-frame updates --------------------------------------------------

  private startWalk(agentId: string, homePos: WorldPoint, targetPos: WorldPoint, dwellMs: number): void {
    if (this.walkStates.has(agentId)) return;
    this.walkStates.set(agentId, {
      phase: 'toTarget',
      elapsedMs: 0,
      homePos,
      targetPos,
      dwellMs,
      yaw: yawTo(homePos, targetPos),
    });
  }

  private tickWalks(deltaMS: number): void {
    for (const [agentId, state] of this.walkStates) {
      const character = this.characters.get(agentId);
      if (!character) {
        this.walkStates.delete(agentId);
        continue;
      }
      state.elapsedMs += deltaMS;

      if (state.phase === 'toTarget') {
        const t = Math.min(1, state.elapsedMs / WALK_LEG_MS);
        const pos = lerp(state.homePos, state.targetPos, easeInOut(t));
        character.setPosition(pos.x, pos.z);
        character.setFacing(state.yaw);
        if (t >= 1) {
          state.phase = 'atTarget';
          state.elapsedMs = 0;
        }
      } else if (state.phase === 'atTarget') {
        if (state.elapsedMs >= state.dwellMs) {
          state.phase = 'toHome';
          state.elapsedMs = 0;
          state.yaw = yawTo(state.targetPos, state.homePos);
        }
      } else {
        const t = Math.min(1, state.elapsedMs / WALK_LEG_MS);
        const pos = lerp(state.targetPos, state.homePos, easeInOut(t));
        character.setPosition(pos.x, pos.z);
        character.setFacing(state.yaw);
        if (t >= 1) {
          this.walkStates.delete(agentId);
        }
      }
    }
  }

  private tickRoaming(deltaMS: number): void {
    this.roamElapsedMs += deltaMS;
    if (this.roamElapsedMs < this.nextRoamAtMs) return;
    this.roamElapsedMs = 0;
    this.nextRoamAtMs = ROAM_MIN_INTERVAL_MS + Math.random() * (ROAM_MAX_INTERVAL_MS - ROAM_MIN_INTERVAL_MS);

    const idleAgents = this.agents.filter(
      (a) => a.id !== 'nova' && (this.statuses.get(a.id) ?? 'idle') === 'idle' && !this.walkStates.has(a.id)
    );
    if (idleAgents.length === 0) return;
    const agent = idleAgents[Math.floor(Math.random() * idleAgents.length)];
    const spot = BREAK_SPOTS[Math.floor(Math.random() * BREAK_SPOTS.length)];
    this.startWalk(agent.id, toWorld({ x: agent.home_x, y: agent.home_y }), spot, ROAM_DWELL_MS);
  }

  private tickEnvelopes(deltaMS: number): void {
    this.envelopes = this.envelopes.filter((env) => {
      env.elapsedMs += deltaMS;
      const t = Math.min(1, env.elapsedMs / ENVELOPE_FLIGHT_MS);
      const pos = lerp(env.fromPos, env.toPos, t);
      const arc = Math.sin(t * Math.PI) * 1.2;
      env.sprite.position.set(pos.x, 0.9 + arc, pos.z);
      const mat = env.sprite.material as THREE.SpriteMaterial;
      mat.opacity = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1;
      if (t >= 1) {
        mat.dispose();
        this.effectsLayer.remove(env.sprite);
        return false;
      }
      return true;
    });
  }

  private tickAmbient(deltaMS: number): void {
    this.ambientT += deltaMS * 0.0015;
    if (this.novaGlowMesh && this.novaLight) {
      const phase = this.ambientT * 0.85 + 1.2;
      const pulse = 0.5 + Math.sin(phase) * 0.5;
      (this.novaGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.16 + pulse * 0.12;
      this.novaLight.intensity = 0.9 + pulse * 0.6;
    }
  }

  private tickWires(deltaMS: number): void {
    this.wirePhase += deltaMS * 0.001;
    for (const line of this.wireLines) {
      const base = line.userData.baseDistances as Float32Array;
      const distances = line.geometry.getAttribute('lineDistance') as THREE.BufferAttribute;
      for (let i = 0; i < base.length; i++) distances.array[i] = base[i] - this.wirePhase;
      distances.needsUpdate = true;
    }
  }
}
