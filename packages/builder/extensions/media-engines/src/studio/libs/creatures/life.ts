/*
  Life for `s.lib.creatures` (character art, 2026-11-05): the small motions that make a drawn
  character feel alive, on the scene's Animator like `anim.peek` — blinks (one in five doubled),
  glances or following the pointer, an ear twitch now and then, antennae that bob, wings that
  flap (fairy wings flutter), a tail that sways, a ghost or star that floats, a slime that wobbles
  and sparkles that twinkle. None of it touches the joints `anim.rig` drives: the runner moves
  inner containers (eyes, ears, wings, tailSway, float), so a walk cycle and a blink compose.

  Nothing runs in the editor or under reduced motion (the Animator cancels the runner at once);
  the first frame is already the rest pose, so a still character looks finished.
*/

import type { Motion } from './build';

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scale: { x: number; y: number };
  alpha?: number;
}

export interface LifeParts {
  eyes: () => Transform | undefined;
  earL?: Transform | undefined;
  earR?: Transform | undefined;
  wingL?: Transform | undefined;
  wingR?: Transform | undefined;
  tailSway?: Transform | undefined;
  float?: Transform | undefined;
  shadow?: Transform | undefined;
  sparkles: readonly Transform[];
}

export interface LifeHost {
  random: () => number;
  /** The pointer in the eyes' parent space, or undefined. */
  pointer: () => { x: number; y: number } | undefined;
}

export interface Life {
  step(dt: number): boolean;
  blink(): void;
  /** A gaze target already converted to eye offsets, or null to hand the eyes back. */
  look(offset: { x: number; y: number } | null): void;
  stop(): void;
  readonly stopped: boolean;
}

/** Max eye travel in figure units. */
export const GAZE = { x: 1.7, y: 1.1 };

export function createLife(
  parts: LifeParts,
  motion: Motion,
  host: LifeHost,
  look: 'wander' | 'pointer' | 'none',
  /** Pixels per figure unit (offsets below are in figure units). */
  unit = 1,
): Life {
  const rnd = host.random;
  let t = rnd() * 10;
  let blinkIn = 1.2 + rnd() * 2.4;
  let blinkT = -1;
  let glanceIn = 0.8 + rnd() * 2;
  let glance = { x: 0, y: 0 };
  let gaze = { x: 0, y: 0 };
  let manual: { x: number; y: number } | null = null;
  let twitchIn = 2.5 + rnd() * 4;
  let twitchT = -1;
  let twitchSide = 1;
  let stopped = false;
  const twitchy =
    motion.ears !== 'none' &&
    motion.ears !== 'antenna' &&
    motion.ears !== 'bolts' &&
    motion.ears !== 'fin';
  const antenna = motion.ears === 'antenna';
  const fins = motion.ears === 'fin';
  const phase = rnd() * Math.PI * 2;

  function aim(dt: number): void {
    let want = { x: 0, y: 0 };
    if (manual !== null) want = manual;
    else if (look === 'pointer') want = host.pointer() ?? { x: 0, y: 0 };
    else if (look === 'wander') {
      glanceIn -= dt;
      if (glanceIn <= 0) {
        glanceIn = 1.2 + rnd() * 2.8;
        glance =
          rnd() < 0.4
            ? { x: 0, y: 0 }
            : { x: (rnd() * 2 - 1) * GAZE.x * unit, y: (rnd() * 2 - 1) * GAZE.y * unit };
      }
      want = glance;
    }
    const k = Math.min(1, dt * 12);
    gaze = { x: gaze.x + (want.x - gaze.x) * k, y: gaze.y + (want.y - gaze.y) * k };
  }

  function render(): void {
    const eyes = parts.eyes();
    if (eyes !== undefined) {
      const closed = blinkT >= 0 ? Math.sin(Math.min(1, blinkT / 0.15) * Math.PI) : 0;
      eyes.scale.y = 1 - closed * 0.92;
      eyes.x = gaze.x;
      eyes.y = gaze.y;
    }
    // Ears: a quick shiver now and then (or a springy bob for antennae and fins).
    const shiver =
      twitchT >= 0 ? Math.sin(twitchT * 46) * 0.16 * Math.max(0, 1 - twitchT / 0.4) : 0;
    if (parts.earL !== undefined) {
      parts.earL.rotation = antenna
        ? Math.sin(t * 3.1 + phase) * 0.09
        : fins
          ? Math.sin(t * 2.4) * 0.07
          : twitchy && twitchSide > 0
            ? shiver
            : 0;
    }
    if (parts.earR !== undefined) {
      parts.earR.rotation = antenna
        ? Math.sin(t * 3.1 + phase + 0.9) * 0.09
        : fins
          ? -Math.sin(t * 2.4) * 0.07
          : twitchy && twitchSide < 0
            ? -shiver
            : 0;
    }
    // Wings: a slow flap (bat, feather) or a fast flutter (fairy).
    if (motion.wings === 'fairy') {
      const f = 0.82 + Math.abs(Math.sin(t * 13)) * 0.18;
      if (parts.wingL !== undefined) parts.wingL.scale.x = f;
      if (parts.wingR !== undefined) parts.wingR.scale.x = f;
    } else if (motion.wings !== 'none') {
      const a = Math.sin(t * 4.2) * 0.2 - 0.04;
      if (parts.wingL !== undefined) parts.wingL.rotation = a;
      if (parts.wingR !== undefined) parts.wingR.rotation = -a;
    }
    if (parts.tailSway !== undefined && motion.tail)
      parts.tailSway.rotation = Math.sin(t * 2.3 + phase) * 0.13;
    if (parts.float !== undefined) {
      if (motion.float) {
        const bob = Math.sin(t * 1.8);
        parts.float.y = (bob * 2.6 - 1.4) * unit;
        parts.float.rotation = Math.sin(t * 1.1) * 0.025;
        if (parts.shadow !== undefined) {
          parts.shadow.scale.x = 1 - bob * 0.06;
          parts.shadow.scale.y = 1 - bob * 0.06;
        }
      } else if (motion.wobble) {
        const w = Math.sin(t * 3.3) * 0.03 + Math.sin(t * 5.1) * 0.012;
        parts.float.scale.x = 1 + w;
        parts.float.scale.y = 1 - w;
      } else {
        // Breathing: a slight rise of the whole figure.
        parts.float.scale.y = 1 + Math.sin(t * 2) * 0.008;
      }
    }
    parts.sparkles.forEach((s, i) => {
      const k = 0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.7);
      s.alpha = k;
    });
  }

  return {
    get stopped() {
      return stopped;
    },
    step(dt) {
      if (stopped) return false;
      let rest = Math.min(Math.max(0, dt), 0.5);
      while (rest > 0) {
        const step = Math.min(rest, 1 / 30);
        rest -= step;
        t += step;
        blinkIn -= step;
        if (blinkIn <= 0 && blinkT < 0) {
          blinkT = 0;
          blinkIn = rnd() < 0.2 ? 0.28 : 2.4 + rnd() * 3;
        }
        if (blinkT >= 0) {
          blinkT += step;
          if (blinkT > 0.15) blinkT = -1;
        }
        twitchIn -= step;
        if (twitchIn <= 0 && twitchT < 0) {
          twitchT = 0;
          twitchSide = rnd() < 0.5 ? 1 : -1;
          twitchIn = 3 + rnd() * 5;
        }
        if (twitchT >= 0) {
          twitchT += step;
          if (twitchT > 0.4) twitchT = -1;
        }
        aim(step);
      }
      render();
      return true;
    },
    blink() {
      blinkT = 0;
    },
    look(offset) {
      manual = offset;
    },
    stop() {
      stopped = true;
    },
  };
}
