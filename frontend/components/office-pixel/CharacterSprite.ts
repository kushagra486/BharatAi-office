import { AnimatedSprite, Container, Graphics } from 'pixi.js';
import type { Agent, TaskStatus } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import type { Direction, OfficeAssets } from './assets';

// Numeric tint per agent color token — the Pixi-friendly counterpart to
// WalkerAvatar.tsx's TOKEN_HEX map (kept in frontend/components/office/,
// unchanged there). Same keys, same colors.
const TOKEN_TINT: Record<string, number> = {
  '--cyan': 0x2fe6d2,
  '--violet': 0x8b7cf6,
  '--amber': 0xffb454,
  '--magenta': 0xff4d6d,
  '--green': 0x4ade80,
};

const IDLE_ANIM_SPEED = 0.06;
const WALK_ANIM_SPEED = 0.18;
const PULSE_SPEED = 0.09;

/** Dept -> badge shape, ported from WalkerAvatar.tsx's ShapePath. */
function drawBadge(shape: Agent['shape']): Graphics {
  const g = new Graphics();
  const s = 9;
  switch (shape) {
    case 'hex':
      g.poly([s * 0.5, 0, s, s * 0.25, s, s * 0.75, s * 0.5, s, 0, s * 0.75, 0, s * 0.25]).fill(0xffffff);
      break;
    case 'diamond':
      g.poly([s * 0.5, 0, s, s * 0.5, s * 0.5, s, 0, s * 0.5]).fill(0xffffff);
      break;
    case 'circle':
      g.circle(s / 2, s / 2, s / 2).fill(0xffffff);
      break;
    case 'rounded-sq':
      g.roundRect(0, 0, s, s, 3).fill(0xffffff);
      break;
    case 'octagon':
    default:
      g.poly([
        s * 0.3, 0, s * 0.7, 0, s, s * 0.3, s, s * 0.7, s * 0.7, s, s * 0.3, s, 0, s * 0.7, 0, s * 0.3,
      ]).fill(0xffffff);
      break;
  }
  return g;
}

export class CharacterSprite {
  readonly agent: Agent;
  readonly view: Container;

  private body: AnimatedSprite;
  private statusDot: Graphics;
  private assets: OfficeAssets;
  private direction: Direction = 'down';
  private moving = false;
  private pulseT = 0;
  private status: TaskStatus = 'idle';

  constructor(agent: Agent, assets: OfficeAssets) {
    this.agent = agent;
    this.assets = assets;

    this.view = new Container();
    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';

    this.body = new AnimatedSprite([assets.characterFrames.idle_down_0, assets.characterFrames.idle_down_1]);
    this.body.anchor.set(0.5, 0.7);
    this.body.tint = TOKEN_TINT[agent.color] ?? TOKEN_TINT['--cyan'];
    this.body.animationSpeed = IDLE_ANIM_SPEED;
    this.body.play();
    this.view.addChild(this.body);

    const badge = drawBadge(agent.shape);
    badge.tint = this.body.tint;
    badge.position.set(9, -22);
    this.view.addChild(badge);

    this.statusDot = new Graphics();
    this.statusDot.position.set(10, 4);
    this.view.addChild(this.statusDot);

    this.setStatus('idle');
    this.applyFrames();
  }

  setPosition(x: number, y: number): void {
    this.view.position.set(x, y);
  }

  setStatus(status: TaskStatus): void {
    this.status = status;
    this.redrawStatusDot();
  }

  /** Called every tick by OfficeScene with the current facing/moving state. */
  setMotion(direction: Direction, moving: boolean): void {
    // scaleX flip is no longer needed — the placeholder/real art has true
    // 4-directional frames — but keeping horizontal mirroring off avoids
    // double-flipping a left/right-specific frame.
    if (direction === this.direction && moving === this.moving) return;
    this.direction = direction;
    this.moving = moving;
    this.applyFrames();
  }

  /** Advance pulse animation for working/blocked status dots. Called once/tick from OfficeScene's ticker. */
  update(deltaTime: number): void {
    if (this.status === 'working' || this.status === 'blocked') {
      this.pulseT += deltaTime * PULSE_SPEED;
      const scale = 1 + Math.sin(this.pulseT) * 0.35;
      this.statusDot.scale.set(scale);
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private applyFrames(): void {
    const frames = this.moving
      ? [0, 1, 2, 3].map((i) => this.assets.characterFrames[`walk_${this.direction}_${i as 0 | 1 | 2 | 3}`])
      : [0, 1].map((i) => this.assets.characterFrames[`idle_${this.direction}_${i as 0 | 1}`]);
    this.body.textures = frames;
    this.body.animationSpeed = this.moving ? WALK_ANIM_SPEED : IDLE_ANIM_SPEED;
    this.body.gotoAndPlay(0);
  }

  private redrawStatusDot(): void {
    this.statusDot.clear();
    this.statusDot.circle(0, 0, 3.5).fill(STATUS_COLOR[this.status]);
    this.pulseT = 0;
    this.statusDot.scale.set(1);
  }
}
