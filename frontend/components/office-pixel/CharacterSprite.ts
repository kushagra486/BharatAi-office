import { AnimatedSprite, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Agent, TaskStatus } from '@bharat-ai-office/shared';
import { STATUS_COLOR } from '@bharat-ai-office/shared';
import type { CharacterFrameKey, Direction, OfficeAssets } from './assets';

// Numeric tint per agent color token — the Pixi-friendly counterpart to
// WalkerAvatar.tsx's TOKEN_HEX map (kept in frontend/components/office/,
// unchanged there). Same keys, same colors. Spread widely around the hue
// wheel (see shared/src/roster.ts) so every one of the 11 agents reads as a
// distinct, vivid, "glowing" color under the grayscale rig's `.tint`
// multiply — not the old 5-color palette that forced several agents to
// share an identical color.
const TOKEN_TINT: Record<string, number> = {
  '--violet': 0x8b7cf6,
  '--red': 0xff4d4d,
  '--orange': 0xff9433,
  '--gold': 0xffd23f,
  '--lime': 0xa8e62e,
  '--emerald': 0x2ecc71,
  '--cyan': 0x2fe6d2,
  '--sky': 0x38bdf8,
  '--blue': 0x5b7fff,
  '--pink': 0xff4fc3,
  '--rose': 0xff4d79,
  // legacy tokens kept for anything still referencing the old 5-color set.
  '--amber': 0xffb454,
  '--magenta': 0xff4d6d,
  '--green': 0x4ade80,
};

const IDLE_ANIM_SPEED = 0.06;
const WALK_ANIM_SPEED = 0.18;
const PULSE_SPEED = 0.09;

// Portrait-mode layout: sized/positioned to land on roughly the same
// bounding box the blocky rig's anchor(0.5, 0.7) 32px frame occupies
// (top ~-22, bottom ~+10), so the badge/status-dot offsets below didn't
// need to change between the two render modes.
const PORTRAIT_RADIUS = 16;
const PORTRAIT_CENTER_Y = -6;
const PORTRAIT_BOB_IDLE = 1;
const PORTRAIT_BOB_WALK = 2;

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

  private readonly isPortrait: boolean;
  private body?: AnimatedSprite;
  private portraitGroup?: Container;
  private statusDot: Graphics;
  private frames: Record<CharacterFrameKey, Texture> | null = null;
  private direction: Direction = 'down';
  private moving = false;
  private pulseT = 0;
  private bobT = 0;
  private status: TaskStatus = 'idle';

  constructor(agent: Agent, assets: OfficeAssets) {
    this.agent = agent;
    const identityTint = TOKEN_TINT[agent.color] ?? TOKEN_TINT['--cyan'];

    this.view = new Container();
    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';

    const portraitTexture = assets.portraitTextures[agent.id];
    this.isPortrait = Boolean(portraitTexture);

    if (portraitTexture) {
      // A real profile photo (same file AgentAvatar.tsx uses) shown as a
      // circular token on the floor, instead of the blocky rig — see
      // ASSETS.md "Dashboard profile photos". No walk-cycle frames exist
      // for a photo, so motion here is a bob (bigger while walking) rather
      // than a leg-swing animation.
      const diameter = PORTRAIT_RADIUS * 2;
      const photo = new Sprite(portraitTexture);
      photo.anchor.set(0.5, 0.5);
      photo.width = diameter;
      photo.height = diameter;

      const mask = new Graphics().circle(0, 0, PORTRAIT_RADIUS).fill(0xffffff);
      photo.mask = mask;

      const ring = new Graphics().circle(0, 0, PORTRAIT_RADIUS).stroke({ width: 2, color: identityTint });

      this.portraitGroup = new Container();
      this.portraitGroup.addChild(photo, mask, ring);
      this.portraitGroup.position.set(0, PORTRAIT_CENTER_Y);
      this.view.addChild(this.portraitGroup);
    } else {
      // Fallback blocky rig — grayscale shared sheet + tint, or a full-color
      // per-agent sheet (see ASSETS.md "Per-agent custom sprites") if one
      // exists for this agent.
      const customFrames = assets.characterFramesByAgent[agent.id];
      this.frames = customFrames ?? assets.characterFrames;

      this.body = new AnimatedSprite([this.frames.idle_down_0, this.frames.idle_down_1]);
      this.body.anchor.set(0.5, 0.7);
      if (!customFrames) this.body.tint = identityTint;
      this.body.animationSpeed = IDLE_ANIM_SPEED;
      this.body.play();
      this.view.addChild(this.body);
    }

    const badge = drawBadge(agent.shape);
    badge.tint = identityTint;
    badge.position.set(9, -22);
    this.view.addChild(badge);

    this.statusDot = new Graphics();
    this.statusDot.position.set(10, 4);
    this.view.addChild(this.statusDot);

    this.setStatus('idle');
    if (!this.isPortrait) this.applyFrames();
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
    if (!this.isPortrait) this.applyFrames();
  }

  /** Advance pulse (status dot) and bob (portrait mode) animations. Called once/tick from OfficeScene's ticker. */
  update(deltaTime: number): void {
    if (this.status === 'working' || this.status === 'blocked') {
      this.pulseT += deltaTime * PULSE_SPEED;
      const scale = 1 + Math.sin(this.pulseT) * 0.35;
      this.statusDot.scale.set(scale);
    }
    if (this.portraitGroup) {
      this.bobT += deltaTime * (this.moving ? 0.28 : 0.09);
      const amplitude = this.moving ? PORTRAIT_BOB_WALK : PORTRAIT_BOB_IDLE;
      this.portraitGroup.position.y = PORTRAIT_CENTER_Y + Math.sin(this.bobT) * amplitude;
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }

  private applyFrames(): void {
    if (!this.body || !this.frames) return;
    const frames = this.moving
      ? [0, 1, 2, 3].map((i) => this.frames![`walk_${this.direction}_${i as 0 | 1 | 2 | 3}`])
      : [0, 1].map((i) => this.frames![`idle_${this.direction}_${i as 0 | 1}`]);
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
