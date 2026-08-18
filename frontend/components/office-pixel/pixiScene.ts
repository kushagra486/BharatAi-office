import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import type { Agent, MessageType, TaskStatus } from '@bharat-ai-office/shared';
import { MESSAGE_COLOR, REVIEW_TABLE_POSITION } from '@bharat-ai-office/shared';
import type { Direction, OfficeAssets, TileKey } from './assets';
import { CharacterSprite } from './CharacterSprite';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, toPixel, toTile, type PercentPoint, type PixelPoint } from './coords';

const WALK_LEG_MS = 1400; // time to walk each leg (home->table, table->home) — matches old DeskSlot CSS transition
const DWELL_MS = 400; // pause at the review table — WALK_LEG_MS*2 + DWELL_MS = 3200ms, matching old WALK_DURATION_MS
const ENVELOPE_FLIGHT_MS = 1600; // matches old OfficeFloor.tsx ENVELOPE_FLIGHT_MS

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
  phase: 'toTable' | 'atTable' | 'toHome';
  elapsedMs: number;
  homePx: PixelPoint;
  tablePx: PixelPoint;
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

  constructor(
    private assets: OfficeAssets,
    agents: Agent[],
    onSelectAgent: (agentId: string) => void
  ) {
    const floorLayer = this.buildFloorLayer();
    const decorLayer = this.buildDecorLayer(agents);
    const charactersLayer = new Container();

    this.root.addChild(floorLayer, decorLayer, charactersLayer, this.effectsLayer);

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
    this.characters.get(agentId)?.setStatus(status);
  }

  /**
   * Starts the walk-to-review-table-and-back sequence for one agent. A no-op
   * if that agent is already mid-walk (mirrors the old Set-based dedupe in
   * OfficeFloor.tsx's useEffect).
   */
  walkAgentToReviewTable(agentId: string, homePct: PercentPoint): void {
    if (this.walkStates.has(agentId)) return;
    const homePx = toPixel(homePct);
    const tablePx = toPixel(REVIEW_TABLE_POSITION);
    this.walkStates.set(agentId, {
      phase: 'toTable',
      elapsedMs: 0,
      homePx,
      tablePx,
      direction: directionOf(homePx, tablePx),
    });
  }

  /** Fires a short-lived tinted dot from one agent's desk to another's (or the table), for message:new. */
  spawnEnvelope(fromPct: PercentPoint, toPct: PercentPoint, messageType: MessageType): void {
    const graphic = new Graphics();
    graphic.circle(0, 0, 4).fill(MESSAGE_COLOR[messageType]);
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
  }

  private tickWalks(deltaMS: number): void {
    for (const [agentId, state] of this.walkStates) {
      const character = this.characters.get(agentId);
      if (!character) {
        this.walkStates.delete(agentId);
        continue;
      }
      state.elapsedMs += deltaMS;

      if (state.phase === 'toTable') {
        const t = Math.min(1, state.elapsedMs / WALK_LEG_MS);
        const pos = lerp(state.homePx, state.tablePx, easeInOut(t));
        character.setPosition(pos.x, pos.y);
        character.setMotion(state.direction, true);
        if (t >= 1) {
          state.phase = 'atTable';
          state.elapsedMs = 0;
        }
      } else if (state.phase === 'atTable') {
        character.setMotion(state.direction, false);
        if (state.elapsedMs >= DWELL_MS) {
          state.phase = 'toHome';
          state.elapsedMs = 0;
          state.direction = directionOf(state.tablePx, state.homePx);
        }
      } else {
        const t = Math.min(1, state.elapsedMs / WALK_LEG_MS);
        const pos = lerp(state.tablePx, state.homePx, easeInOut(t));
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

  private buildFloorLayer(): Container {
    const layer = new Container();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const isEdge = row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1;
        const key: TileKey = isEdge ? 'wall_edge' : (row + col) % 2 === 0 ? 'floor_a' : 'floor_b';
        const tile = new Sprite(this.assets.tiles[key]);
        tile.position.set(col * TILE_SIZE, row * TILE_SIZE);
        layer.addChild(tile);
      }
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

    const tablePos = toTile(REVIEW_TABLE_POSITION);
    const table = new Sprite(this.assets.tiles.review_table);
    table.anchor.set(0.5, 0.5);
    table.scale.set(1.6);
    table.position.set(tablePos.col * TILE_SIZE + TILE_SIZE / 2, tablePos.row * TILE_SIZE + TILE_SIZE / 2);
    layer.addChild(table);

    // Dashed wire from each employee desk to the review table — ported
    // from OfficeFloor.tsx's SVG <line strokeDasharray>.
    const wires = new Graphics();
    for (const agent of agents) {
      if (agent.id === 'nova') continue;
      this.drawDashedLine(wires, toPixel({ x: agent.home_x, y: agent.home_y }), toPixel(REVIEW_TABLE_POSITION));
    }
    layer.addChildAt(wires, 0);

    return layer;
  }

  private drawDashedLine(g: Graphics, from: PixelPoint, to: PixelPoint): void {
    const dashLen = 6;
    const gapLen = 8;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / (dashLen + gapLen));
    const ux = dx / dist;
    const uy = dy / dist;
    for (let i = 0; i < steps; i++) {
      const start = i * (dashLen + gapLen);
      const end = start + dashLen;
      g.moveTo(from.x + ux * start, from.y + uy * start);
      g.lineTo(from.x + ux * end, from.y + uy * end);
    }
    g.stroke({ width: 1, color: 0x1d2836 });
  }
}
