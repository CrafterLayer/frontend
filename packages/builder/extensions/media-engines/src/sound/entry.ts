import { ensureCkEngines, type CkEngine, type CkEnginesHost } from '../ck-engines';
import { createSoundEngine } from './engine';
import type { CkSound } from './types';

function mountToggle(win: Window, api: CkSound): () => void {
  const doc = win.document;
  const button = doc.createElement('button');
  button.setAttribute('data-ck-sound-toggle', '');
  button.style.cssText = 'position:fixed;bottom:16px;right:16px;width:44px;height:44px';
  const update = (): void => {
    const ar = doc.documentElement.lang.startsWith('ar');
    button.setAttribute('aria-pressed', String(!api.muted));
    button.setAttribute(
      'aria-label',
      api.muted ? (ar ? 'تشغيل' : 'Sound on') : ar ? 'كتم' : 'Mute',
    );
    button.textContent = api.muted ? '🔇' : '🔊';
  };
  const click = (): void => {
    if (api.muted) {
      api.setMuted(false);
      api.unlock();
    } else {
      api.setMuted(true);
    }
  };
  button.addEventListener('click', click);
  const unsubscribe = api.onChange(update);
  update();
  doc.body.appendChild(button);
  return () => {
    unsubscribe();
    button.remove();
  };
}

/** Install one sound engine per document and expose it through the shared engine handshake. */
export function installSoundEngine(win: Window & CkEnginesHost): CkSound {
  const api = createSoundEngine(win);
  let unbind = (): void => undefined;
  let removeToggle = (): void => undefined;
  const start = (): void => {
    unbind = api.bind(win.document.documentElement);
    removeToggle = mountToggle(win, api);
  };
  if (win.document.readyState === 'loading') {
    win.document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
  const engine: CkEngine = {
    mount(_element, context) {
      context.provide?.(api);
      return () => undefined;
    },
  };
  ensureCkEngines(win).ready('sound', engine);
  win.addEventListener(
    'pagehide',
    () => {
      unbind();
      removeToggle();
      api.dispose();
    },
    { once: true },
  );
  return api;
}
