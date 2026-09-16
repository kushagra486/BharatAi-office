import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import type { Agent, MessageType, TaskStatus } from '@bharat-ai-office/shared';
import { MESSAGE_COLOR, REVIEW_TABLE_POSITION } from '@bharat-ai-office/shared';
import type { Direction, OfficeAssets, TileKey } from './assets';
import { CharacterSprite } from './CharacterSprite';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, toPixel, toTile, type PercentPoint, type PixelPoint } from './coords';

const WALK_LEG_MS = 1400; // time to walk each leg (home->table, table->home) — matches old DeskSlot CSS transition
const DWELL_MS = 400; // pause at the review table — WALK_LEG_MS*2 + DWELL_MS = 3200ms, matching old WALK_DURATION_MS
const ENVELOPE_FLIGHT_MS = 1600; // matches old OfficeFloor.tsx ENVELOPE_FLIGHT_MS

// Idle "break" roaming — every few seconds, one idle (not working/blocked,
// not already walking) employee wanders to a random break spot (water
// cooler, plant, bookshelf, printer) and back, so the office reads as
// lived-in even when no task is in flight.
const ROAM_DWELL_MS = 1400; // longer pause than a review-table handoff — this is a break, not a drop-off
const ROAM_MIN_INTERVAL_MS = 4500;
const ROAM_MAX_INTERVAL_MS = 9000;

// Department -> the floor rug tinting its desk cluster sits on, so the room
// reads as distinct zones even though desks are laid out in two plain rows
// (see FRONTEND_VISION.md §2). Nova's tile already gets its own violet
// `nova_office` decor sprite, so it isn't in this map.
const DEPT_RUG: Record<string, TileKey> = {
  eng: 'rug_eng',
  design: 'rug_design',
  data: 'rug_data',
  ops: 'rug_ops',
};

// Windows punched into the exterior wall (row 0), avoiding the columns Nova's
// enclosed office sits above.
const WINDOW_COLS = new Set([3, 7, 22, 26]);

// Nova's office is a small enclosed room in the top-center: side walls on
// rows 1-3, a wall with a 2-tile door gap closing it off at row 4.
const NOVA_WALL_COLS = new Set([11, 20]);
const NOVA_WALL_ROW = 4;
const NOVA_WALL_COL_RANGE = { min: 11, max: 20 };
const NOVA_DOOR_COLS = new Set([15, 16]);

// Fixed set-dressing placed in the aisles/corners that desks don't occupy.
const DECOR_PROPS: { col: number; row: number; key: TileKey }[] = [
  { col: 2, row: 2, key: 'plant' },
  { col: 27, row: 2, key: 'plant' },
  { col: 15, row: 14, key: 'plant' },
  { col: 2, row: 8, key: 'water_cooler' },
  { col: 27, row: 8, key: 'printer' },
  { col: 2, row: 13, key: 'bookshelf' },
  { col: 27, row: 13, key: 'bookshelf' },
];

// Every decor prop doubles as a "break spot" idle employees can wander to —
// derived from the same fixed layout so the two never drift out of sync.
const BREAK_SPOTS: PixelPoint[] = DECOR_PROPS.map((p) => ({
  x: p.col * TILE_SIZE + TILE_SIZE / 2,
  y: p.row * TILE_SIZE + TILE_SIZE / 2,
}));

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: PixelPoint, b: PixelPoint, t: number): PixelPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function directionOf(from: PixelPoint, to: PixelPoint): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

interface WalkState {
  phase: 'toTarget' | 'atTarget' | 'toHome';
  elapsedMs: number;
  homePx: PixelPoint;
  targetPx: PixelPoint;
  dwellMs: number;
  direction: Direction;
}

interface EnvelopeState {
  graphic: Graphics;
  fromPx: PixelPoint;
  toPx: PixelPoint;
  elapsedMs: number;
}

/**
 * Owns the Pixi Container tree and all imperative scene state. OfficeFloorPixel.tsx
 * only ever calls these methods in response to prop changes — no Pixi API calls
 * live in the React component body.
 */
export class OfficeScene {
  readonly root = new Container();

  private characters = new Map<string, CharacterSprite>();
  private walkStates = new Map<string, WalkState>();
  private envelopes: EnvelopeState[] = [];
  private effectsLayer = new Container();
  private tickerFn: (ticker: Ticker) => void;
  private ambientT = 0;
  private novaAura: Graphics | null = null;
  private statuses = new Map<string, TaskStatus>();
  private roamElapsedMs = 0;
  private nextRoamAtMs = ROAM_MIN_INTERVAL_MS + Math.random() * (ROAM_MAX_INTERVAL_MS - ROAM_MIN_INTERVAL_MS);
  private wiresGraphic!: Graphics;
  private wirePhasePx = 0;

  constructor(
    private assets: OfficeAssets,
    private agents: Agent[],
    onSelectAgent: (agentId: string) => void
  ) {
    const floorLayer = this.buildFloorLayer(agents);
    const decorLayer = this.buildDecorLayer(agents);
    const ambientLayer = this.buildAmbientLayer(agents);
    const charactersLayer = new Container();

    this.root.addChild(floorLayer, decorLayer, ambientLayer, charactersLayer, this.effectsLayer);

    for (const agent of agents) {
      const character = new CharacterSprite(agent, assets);
      const pos = toPixel({ x: agent.home_x, y: agent.home_y });
      character.setPosition(pos.x, pos.y);
      // onSelectAgent is a stable ref-backed callback (see OfficeFloorPixel.tsx)
      // so it always dispatches to the latest prop despite being bound once here.
      character.view.on('pointertap', () => onSelectAgent(agent.id));
      charactersLayer.addChild(character.view);
      this.characters.set(agent.id, character);
    }

    this.tickerFn = (ticker) => this.tick(ticker.deltaMS, ticker.deltaTime);
  }

  attachTicker(ticker: { add: (fn: (ticker: Ticker) => void) => void; remove: (fn: (ticker: Ticker) => void) => void }): void {
    ticker.add(this.tickerFn);
  }

  detachTicker(ticker: { remove: (fn: (ticker: Ticker) => void) => void }): void {
    ticker.remove(this.tickerFn);
  }

  /** Push a status update (idle/working/blocked/done) for one agent's status dot. */
  setAgentStatus(agentId: string, status: TaskStatus): void {
    this.statuses.set(agentId, status);
    this.characters.get(agentId)?.setStatus(status);
  }

  /**
   * Starts the walk-to-review-table-and-back sequence for one agent. A no-op
   * if that agent is already mid-walk (mirrors the old Set-based dedupe in
   * OfficeFloor.tsx's useEffect).
   */
  walkAgentToReviewTable(agentId: string, homePct: PercentPoint): void {
    this.startWalk(agentId, homePct, toPixel(REVIEW_TABLE_POSITION), DWELL_MS);
  }

  /**
   * The one walk state-machine backing both real review-table trips and
   * idle "break" roams (see `tickRoaming`) — same lerp/ease/dwell mechanics,
   * just a different target point and dwell time. A no-op if the agent is
   * already mid-walk, so a roam attempt never interrupts a real trip (or
   * vice versa).
   */
  private startWalk(agentId: string, homePct: PercentPoint, targetPx: PixelPoint, dwellMs: number): void {
    if (this.walkStates.has(agentId)) return;
    const homePx = toPixel(homePct);
    this.walkStates.set(agentId, {
      phase: 'toTarget',
      elapsedMs: 0,
      homePx,
      targetPx,
      dwellMs,
      direction: directionOf(homePx, targetPx),
    });
  }

  /** Fires a short-lived tinted "packet" from one agent's desk to another's (or the table), for message:new. */
  spawnEnvelope(fromPct: PercentPoint, toPct: PercentPoint, messageType: MessageType): void {
    const color = MESSAGE_COLOR[messageType];
    const graphic = new Graphics();
    // A soft outer glow halo behind the core dot reads more like a moving
    // packet of information than a flat dot flying across the floor.
    graphic.circle(0, 0, 8).fill({ color, alpha: 0.28 });
    graphic.circle(0, 0, 3.5).fill(color);
    const fromPx = toPixel(fromPct);
    graphic.position.set(fromPx.x, fromPx.y);
    this.effectsLayer.addChild(graphic);
    this.envelopes.push({ graphic, fromPx, toPx: toPixel(toPct), elapsedMs: 0 });
  }

  destroy(): void {
    for (const character of this.characters.values()) character.destroy();
    this.characters.clear();
    this.root.destroy({ children: true });
  }

  private tick(deltaMS: number, deltaTime: number): void {
    for (const character of this.characters.values()) character.update(deltaTime);
    this.tickWalks(deltaMS);
    this.tickEnvelopes(deltaMS);
    this.tickAmbient(deltaMS);
    this.tickRoaming(deltaMS);
    this.tickWires(deltaMS);
  }

  /**
   * Every few seconds, sends one random idle employee on a walk to a random
   * break spot (water cooler, plant, bookshelf, printer) and back — purely
   * cosmetic "office feels alive" behavior, gated on real status so it never
   * runs on a working/blocked agent or interrupts a real review-table trip.
   */
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
    this.startWalk(agent.id, { x: agent.home_x, y: agent.home_y }, spot, ROAM_DWELL_MS);
  }

  /** Advances the marching-ants phase on the desk->table wires so information reads as continuously flowing, not static. */
  private tickWires(deltaMS: number): void {
    this.wirePhasePx += deltaMS * 0.02;
    this.redrawWires();
  }

  /** A slow "breathing" glow at Nova's office — a modern ambient-light touch so the room reads as alive even when idle. */
  private tickAmbient(deltaMS: number): void {
    this.ambientT += deltaMS * 0.0015;
    if (this.novaAura) {
      const phase = this.ambientT * 0.85 + 1.2;
      this.novaAura.alpha = 0.24 + Math.sin(phase) * 0.12;
      this.novaAura.scale.set(0.88 + Math.sin(phase) * 0.12);
    }
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
        const pos = lerp(state.homePx, state.targetPx, easeInOut(t));
        character.setPosition(pos.x, pos.y);
        character.setMotion(state.direction, true);
        if (t >= 1) {
          state.phase = 'atTarget';
          state.elapsedMs = 0;
        }
      } else if (state.phase === 'atTarget') {
        character.setMotion(state.direction, false);
        if (state.elapsedMs >= state.dwellMs) {
          state.phase = 'toHome';
          state.elapsedMs = 0;
          state.direction = directionOf(state.targetPx, state.homePx);
        }
      } else {
        const t = Math.min(1, state.elapsedMs / WALK_LEG_MS);
        const pos = lerp(state.targetPx, state.homePx, easeInOut(t));
        character.setPosition(pos.x, pos.y);
        character.setMotion(state.direction, true);
        if (t >= 1) {
          character.setMotion(state.direction, false);
          this.walkStates.delete(agentId);
        }
      }
    }
  }

  private tickEnvelopes(deltaMS: number): void {
    this.envelopes = this.envelopes.filter((env) => {
      env.elapsedMs += deltaMS;
      const t = Math.min(1, env.elapsedMs / ENVELOPE_FLIGHT_MS);
      const pos = lerp(env.fromPx, env.toPx, t);
      env.graphic.position.set(pos.x, pos.y);
      env.graphic.alpha = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1;
      if (t >= 1) {
        env.graphic.destroy();
        return false;
      }
      return true;
    });
  }

  /**
   * Lays the floor tile-by-tile, overriding the plain checkerboard with:
   * department rugs under each employee's desk (so the office reads as
   * distinct team zones without moving anyone), windows in the exterior
   * wall, and a partitioned room enclosing Nova's desk. See FRONTEND_VISION.md
   * §2 for the "real office" rationale.
   */
  private buildFloorLayer(agents: Agent[]): Container {
    const layer = new Container();

    // The desk sprite (decor layer, drawn after this) covers almost its
    // entire tile, so a rug painted only on that exact tile would be
    // invisible. Instead paint a small patch flanking each desk — the desk
    // row plus the aisle tile behind it — so the department color reads
    // clearly on either side without touching a neighboring desk's patch
    // (roster.ts spaces desks at least 4 tiles apart).
    const rugAt = new Map<string, TileKey>();
    for (const agent of agents) {
      if (agent.id === 'nova') continue;
      const rug = DEPT_RUG[agent.dept];
      if (!rug) continue;
      const { col, row } = toTile({ x: agent.home_x, y: agent.home_y });
      for (const dc of [-1, 0, 1]) {
        for (const dr of [0, 1]) {
          rugAt.set(`${col + dc},${row + dr}`, rug);
        }
      }
    }

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isOuterEdge = row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1;
        const isNovaWallRow = row === NOVA_WALL_ROW && col >= NOVA_WALL_COL_RANGE.min && col <= NOVA_WALL_COL_RANGE.max;
        const isNovaSideWall = row > 0 && row < NOVA_WALL_ROW && NOVA_WALL_COLS.has(col);

        let key: TileKey;
        const rugKey = rugAt.get(`${col},${row}`);
        if (rugKey) {
          key = rugKey;
        } else if (isOuterEdge) {
          key = row === 0 && WINDOW_COLS.has(col) ? 'window' : 'wall_edge';
        } else if (isNovaWallRow && !NOVA_DOOR_COLS.has(col)) {
          key = 'wall_inner';
        } else if (isNovaSideWall) {
          key = 'wall_inner';
        } else {
          key = (row + col) % 2 === 0 ? 'floor_a' : 'floor_b';
        }

        const tile = new Sprite(this.assets.tiles[key]);
        tile.position.set(col * TILE_SIZE, row * TILE_SIZE);
        layer.addChild(tile);
      }
    }
    return layer;
  }

  /** Soft violet under-glow aura at Nova's office. */
  private buildAmbientLayer(agents: Agent[]): Container {
    const layer = new Container();

    const nova = agents.find((a) => a.id === 'nova');
    if (nova) {
      const novaPx = toPixel({ x: nova.home_x, y: nova.home_y });
      this.novaAura = new Graphics().circle(0, 0, 34).fill(0xd6a854);
      this.novaAura.alpha = 0.22;
      this.novaAura.position.set(novaPx.x, novaPx.y);
      layer.addChild(this.novaAura);
    }

    return layer;
  }

  private buildDecorLayer(agents: Agent[]): Container {
    const layer = new Container();

    for (const agent of agents) {
      const { col, row } = toTile({ x: agent.home_x, y: agent.home_y });
      const key: TileKey = agent.id === 'nova' ? 'nova_office' : 'desk';
      const tile = new Sprite(this.assets.tiles[key]);
      tile.anchor.set(0.5, 0.5);
      tile.position.set(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
      layer.addChild(tile);
    }

    // No visible marker at REVIEW_TABLE_POSITION by design — agents still
    // walk there on task completion (walkAgentToReviewTable) and the wires
    // still flow toward it, but the spot itself is left as open floor.
    for (const prop of DECOR_PROPS) {
      const sprite = new Sprite(this.assets.tiles[prop.key]);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(prop.col * TILE_SIZE + TILE_SIZE / 2, prop.row * TILE_SIZE + TILE_SIZE / 2);
      layer.addChild(sprite);
    }

    // Dashed wire from each employee desk to the review table, animated in
    // `redrawWires` (called from `tickWires`) so it reads as information
    // continuously flowing toward the table rather than a static line.
    this.wiresGraphic = new Graphics();
    layer.addChildAt(this.wiresGraphic, 0);
    this.redrawWires();

    return layer;
  }

  /** Redraws the desk->table wires with the current marching-ants phase — cheap enough to call every tick at this scale (10 short dashed lines). */
  private redrawWires(): void {
    this.wiresGraphic.clear();
    for (const agent of this.agents) {
      if (agent.id === 'nova') continue;
      this.drawDashedLine(this.wiresGraphic, toPixel({ x: agent.home_x, y: agent.home_y }), toPixel(REVIEW_TABLE_POSITION), this.wirePhasePx);
    }
  }

  private drawDashedLine(g: Graphics, from: PixelPoint, to: PixelPoint, phasePx: number): void {
    const dashLen = 6;
    const gapLen = 8;
    const cycle = dashLen + gapLen;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const ux = dx / dist;
    const uy = dy / dist;
    // Shifting the pattern's start by `phasePx` each tick makes the dashes
    // appear to crawl from the desk toward the table — a constant, ambient
    // "information flowing toward review" signal even with no real message.
    const offset = ((phasePx % cycle) + cycle) % cycle;
    for (let start = -offset; start < dist; start += cycle) {
      const segStart = Math.max(0, start);
      const segEnd = Math.min(dist, start + dashLen);
      if (segEnd <= segStart) continue;
      g.moveTo(from.x + ux * segStart, from.y + uy * segStart);
      g.lineTo(from.x + ux * segEnd, from.y + uy * segEnd);
    }
    g.stroke({ width: 1, color: 0x6b5f48, alpha: 0.4 });
  }
}
