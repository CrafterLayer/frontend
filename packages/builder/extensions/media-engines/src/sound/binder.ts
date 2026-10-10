import {
  parseSoundAttributeRuntime,
  type SoundRefSpec,
  type SoundToken,
} from '@craftkit/builder-schema';

import type { CkSound, SoundPlayOptions, SoundRef } from './types';

const HOVER_THROTTLE_MS = 120;

type ObserverConstructor = new (
  callback: (entries: readonly IntersectionObserverEntry[]) => void,
) => IntersectionObserver;

function refOf(ref: SoundRefSpec): SoundRef {
  if (ref.kind === 'bank') return ref.id;
  if (ref.kind === 'lib') return `lib:${ref.id}`;
  if (ref.kind === 'asset') return `asset:${ref.id}`;
  return ref.params;
}

function play(api: CkSound, token: SoundToken): void {
  const options: SoundPlayOptions = {};
  if (token.volume !== undefined) options.volume = token.volume;
  api.play(refOf(token.ref), options);
}

function soundElements(root: Element): Element[] {
  const elements = Array.from(root.querySelectorAll('[data-ck-sound]'));
  if (root.matches('[data-ck-sound]')) elements.unshift(root);
  return elements;
}

/** Bind validated data-ck-sound tokens without evaluating attribute text as code. */
export function bindSoundElements(root: Element, api: CkSound, win: Window): () => void {
  const cleanups: (() => void)[] = [];
  const coarse =
    typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  const Observer = (win as Window & { IntersectionObserver?: ObserverConstructor })
    .IntersectionObserver;

  for (const element of soundElements(root)) {
    const parsed = parseSoundAttributeRuntime(element.getAttribute('data-ck-sound') ?? '');
    if (parsed === undefined) continue;
    for (const token of parsed.tokens) {
      if (token.trigger === 'ambient') {
        const options =
          token.volume === undefined ? { el: element } : { el: element, volume: token.volume };
        cleanups.push(api.ambient(refOf(token.ref), options));
        continue;
      }
      if (token.trigger === 'enter') {
        if (Observer === undefined) continue;
        const observer = new Observer((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          play(api, token);
        });
        observer.observe(element);
        cleanups.push(() => {
          observer.disconnect();
        });
        continue;
      }
      if (token.trigger === 'hover' && coarse) continue;
      let lastHover = -Infinity;
      const event =
        token.trigger === 'click'
          ? 'click'
          : token.trigger === 'hover'
            ? 'pointerenter'
            : 'pointerleave';
      const handler = (): void => {
        if (token.trigger === 'hover') {
          const now = win.performance.now();
          if (now - lastHover < HOVER_THROTTLE_MS) return;
          lastHover = now;
        }
        play(api, token);
      };
      element.addEventListener(event, handler, { passive: true });
      cleanups.push(() => {
        element.removeEventListener(event, handler);
      });
    }
  }

  return () => {
    for (let index = cleanups.length - 1; index >= 0; index -= 1) cleanups[index]?.();
    cleanups.length = 0;
  };
}
