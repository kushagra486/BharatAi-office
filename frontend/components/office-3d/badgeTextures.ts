import * as THREE from 'three';
import type { Agent } from '@bharat-ai-office/shared';

// Canvas-drawn department badge shapes, rendered once per shape and cached —
// the 3D-scene equivalent of CharacterSprite.ts's (Pixi) drawBadge(). Drawn
// white so a SpriteMaterial's `color` (the agent's identity color) tints it,
// same "white shape + tint" trick as the 2D version.
const SIZE = 64;
const cache = new Map<Agent['shape'], THREE.Texture>();

function drawShape(ctx: CanvasRenderingContext2D, shape: Agent['shape']): void {
  const s = SIZE;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  switch (shape) {
    case 'hex':
      ctx.moveTo(s * 0.5, 0);
      ctx.lineTo(s, s * 0.25);
      ctx.lineTo(s, s * 0.75);
      ctx.lineTo(s * 0.5, s);
      ctx.lineTo(0, s * 0.75);
      ctx.lineTo(0, s * 0.25);
      break;
    case 'diamond':
      ctx.moveTo(s * 0.5, 0);
      ctx.lineTo(s, s * 0.5);
      ctx.lineTo(s * 0.5, s);
      ctx.lineTo(0, s * 0.5);
      break;
    case 'circle':
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
      break;
    case 'rounded-sq': {
      const r = s * 0.2;
      ctx.moveTo(r, 0);
      ctx.arcTo(s, 0, s, s, r);
      ctx.arcTo(s, s, 0, s, r);
      ctx.arcTo(0, s, 0, 0, r);
      ctx.arcTo(0, 0, s, 0, r);
      break;
    }
    case 'octagon':
    default:
      ctx.moveTo(s * 0.3, 0);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(s, s * 0.3);
      ctx.lineTo(s, s * 0.7);
      ctx.lineTo(s * 0.7, s);
      ctx.lineTo(s * 0.3, s);
      ctx.lineTo(0, s * 0.7);
      ctx.lineTo(0, s * 0.3);
      break;
  }
  ctx.closePath();
  ctx.fill();
}

export function badgeTexture(shape: Agent['shape']): THREE.Texture {
  const cached = cache.get(shape);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  drawShape(ctx, shape);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(shape, texture);
  return texture;
}

/** A soft circular dot texture, shared by every status dot / envelope sprite. */
let dotTextureCache: THREE.Texture | null = null;
export function dotTexture(): THREE.Texture {
  if (dotTextureCache) return dotTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  dotTextureCache = new THREE.CanvasTexture(canvas);
  dotTextureCache.colorSpace = THREE.SRGBColorSpace;
  return dotTextureCache;
}
