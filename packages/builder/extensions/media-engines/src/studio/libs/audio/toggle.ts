/*
  The audio control `s.lib.audio` renders whenever a scene asks for music (WCAG 1.4.2 Audio
  Control): a native <button> in the scene's region, keyboard and screen-reader operable, with a
  stable bilingual name and `aria-pressed` carrying the muted state. Colours come from the site
  tokens like the dialogue box; nothing is installed outside the region, and dispose() removes it.
*/

import type { AudioLabels, AudioOptions } from './types';

const EN: AudioLabels = { mute: 'Mute sound' };
const AR: AudioLabels = { mute: 'كتم الصوت' };

const STYLE_ID = 'ck-audio-style';
const CSS = `
.ck-audio-toggle{position:absolute;z-index:4;inline-size:2.75rem;block-size:2.75rem;display:inline-grid;place-items:center;padding:0;border-radius:999px;font:inherit;font-size:1.15rem;line-height:1;cursor:pointer;color:var(--t-text,#f8fafc);background:color-mix(in oklab,var(--t-surface,#0f172a) 82%,transparent);border:1px solid color-mix(in oklab,var(--t-accent,#7c3aed) 55%,transparent)}
.ck-audio-toggle:focus-visible{outline:3px solid var(--t-accent,#7c3aed);outline-offset:2px}
.ck-audio-toggle[data-place^=top]{inset-block-start:.6rem}
.ck-audio-toggle[data-place^=bottom]{inset-block-end:.6rem}
.ck-audio-toggle[data-place$=end]{inset-inline-end:.6rem}
.ck-audio-toggle[data-place$=start]{inset-inline-start:.6rem}
`;

export interface AudioToggle {
  readonly element: HTMLButtonElement;
  /** Reflect the muted state. */
  sync(muted: boolean): void;
  remove(): void;
}

/** The page language decides the default name: Arabic pages get Arabic labels. */
export function audioLabels(root: Element, given: Partial<AudioLabels> | undefined): AudioLabels {
  const lang = (root.closest('[lang]')?.getAttribute('lang') ?? '').toLowerCase();
  return { ...(lang.startsWith('ar') ? AR : EN), ...(given ?? {}) };
}

export function mountAudioToggle(
  root: HTMLElement,
  labels: AudioLabels,
  place: NonNullable<AudioOptions['toggle']>,
  onToggle: () => void,
): AudioToggle {
  const doc = root.ownerDocument;
  if (doc.getElementById(STYLE_ID) === null) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'ck-audio-toggle';
  button.setAttribute('data-ck-audio-toggle', '');
  button.setAttribute('data-place', place);
  button.setAttribute('aria-label', labels.mute);
  button.title = labels.mute;
  const icon = doc.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  const click = (): void => {
    onToggle();
  };
  button.addEventListener('click', click);
  root.appendChild(button);
  return {
    element: button,
    sync(muted) {
      button.setAttribute('aria-pressed', String(muted));
      icon.textContent = muted ? '🔇' : '🔊';
    },
    remove() {
      button.removeEventListener('click', click);
      button.remove();
    },
  };
}
