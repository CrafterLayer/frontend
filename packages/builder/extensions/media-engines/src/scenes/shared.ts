/*
  Helpers the five scenes share. Pixi imports here stay inside the entry.ts
  subset (Application, Container, Sprite, Graphics, Texture, filters).
*/

import type { Application, Sprite, Texture } from 'pixi.js';
import { Texture as PixiTexture } from 'pixi.js';

import type { SceneContext, SceneFactory } from '../engine';

export type PixiSceneContext = SceneContext<Texture>;
export type PixiScene = SceneFactory<Application, Texture>;

/** Deterministic pseudo-random numbers, so the still canvas frame is stable between reloads. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e37_79b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** A stable seed per element: its scene name and image count, so two identical scenes match. */
export function seedFor(name: string, salt: number): number {
  let hash = 2_166_136_261;
  for (const char of `${name}:${String(salt)}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  return hash >>> 0;
}

/** Scale and centre a sprite so it covers `width × height` (CSS `object-fit: cover`). */
export function coverSprite(sprite: Sprite, width: number, height: number, overscan = 1): void {
  const texture = sprite.texture;
  const tw = Math.max(texture.width, 1);
  const th = Math.max(texture.height, 1);
  const scale = Math.max(width / tw, height / th) * overscan;
  sprite.anchor.set(0.5);
  sprite.scale.set(scale);
  sprite.position.set(width / 2, height / 2);
}

/**
 * A soft value-noise map for DisplacementFilter (red = x, green = y, 128 =
 * no displacement). Drawn once on a 2D canvas that never enters the page.
 */
export function noiseMapTexture(doc: Document, random: () => number, size = 256): Texture {
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const coarse = 16;
    const small = doc.createElement('canvas');
    small.width = coarse;
    small.height = coarse;
    const smallContext = small.getContext('2d');
    if (smallContext !== null) {
      const image = smallContext.createImageData(coarse, coarse);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = 64 + Math.round(random() * 128);
        image.data[i + 1] = 64 + Math.round(random() * 128);
        image.data[i + 2] = 128;
        image.data[i + 3] = 255;
      }
      smallContext.putImageData(image, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(small, 0, 0, size, size);
    }
  }
  const texture = PixiTexture.from(canvas);
  texture.source.addressMode = 'repeat';
  return texture;
}

/**
 * Concentric rings around a neutral edge, for the pointer ripple. The outer
 * pixels are exactly 128/128 so the filter does nothing outside the ring.
 */
export function rippleMapTexture(doc: Document, size = 256): Texture {
  const canvas = doc.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const half = size / 2;
    context.fillStyle = 'rgb(128,128,128)';
    context.fillRect(0, 0, size, size);
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    const rings = 5;
    for (let i = 0; i <= rings; i++) {
      const stop = i / rings;
      const fade = 1 - stop;
      const swing = Math.round(70 * fade) * (i % 2 === 0 ? 1 : -1);
      gradient.addColorStop(stop, `rgb(${String(128 + swing)},${String(128 + swing)},128)`);
    }
    gradient.addColorStop(1, 'rgb(128,128,128)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return PixiTexture.from(canvas);
}

/** Pointer position over `host`, normalised to -1…1 on each axis (0,0 = centre). */
export function trackPointer(host: HTMLElement): {
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
  dispose(): void;
} {
  const state = { x: 0, y: 0, active: false };
  const onMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    state.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    state.active = true;
  };
  const onLeave = () => {
    state.active = false;
  };
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave, { passive: true });
  return {
    get x() {
      return state.x;
    },
    get y() {
      return state.y;
    },
    get active() {
      return state.active;
    },
    dispose() {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    },
  };
}

/** Where the element sits in its viewport: -1 (below) … 0 (centred) … 1 (above). */
export function scrollProgress(el: HTMLElement, win: Window): number {
  const rect = el.getBoundingClientRect();
  const viewport = win.innerHeight || 1;
  const centre = rect.top + rect.height / 2;
  const progress = (viewport / 2 - centre) / viewport;
  return Math.max(-1, Math.min(1, progress));
}
