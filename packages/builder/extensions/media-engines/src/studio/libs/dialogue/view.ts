/*
  The accessible dialogue box behind `s.lib.dialogue.view(talk, options)` (creative engines,
  2026-10-12).

  Story text, speaker names and choices live in real DOM over the canvas — never canvas-only:
  native buttons, a polite live region carrying each full line (the typewriter effect is visual
  only), number keys 1–8 for choices while focus is inside the box, a collapsible transcript, and
  Arabic or English labels from the page language. Colours come from the site tokens
  (--t-surface, --t-text, --t-accent…) with the speaker's cast colour as an accent.

  The view never installs window or document listeners: keys are read on the box itself, and
  dispose() removes everything it added.
*/

import type { DialogueLike, DialogueLine } from './types';

export interface DialogueViewLabels {
  next: string;
  restart: string;
  choices: string;
  history: string;
  dialogue: string;
  end: string;
}

export interface DialogueViewOptions {
  /** The element to mount in (usually ck.root). */
  root: HTMLElement;
  labels?: Partial<DialogueViewLabels>;
  /** Characters per second for the typewriter; 0 shows lines at once. */
  speed?: number;
  reducedMotion?: boolean;
  /** False on the editor canvas: render the line, but buttons do nothing. */
  interactive?: boolean;
  /** 'overlay' sits on the bottom of the region; 'inline' flows in the document. */
  placement?: 'overlay' | 'inline';
  /** Show portraits from the cast when a speaker has one. */
  portraits?: boolean;
  /** Called after every render, e.g. to move characters or play a cue. */
  onRender?: (line: DialogueLine) => void;
}

export interface DialogueView {
  readonly element: HTMLElement;
  render(): void;
  /** Finish the typewriter at once. */
  skip(): void;
  dispose(): void;
}

const EN: DialogueViewLabels = {
  next: 'Continue',
  restart: 'Play again',
  choices: 'Choices',
  history: 'Story so far',
  dialogue: 'Dialogue',
  end: 'The end',
};

const AR: DialogueViewLabels = {
  next: 'متابعة',
  restart: 'العب من جديد',
  choices: 'الخيارات',
  history: 'ما جرى حتى الآن',
  dialogue: 'الحوار',
  end: 'النهاية',
};

const CONNECTED_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const STYLE_ID = 'ckd-style';
const CSS = `
.ckd{--ckd-accent:var(--t-accent,#7c3aed);--ckd-surface:var(--t-surface,#0f172a);--ckd-text:var(--t-text,#f8fafc);--ckd-muted:var(--t-text-muted,#cbd5e1);font:inherit;color:var(--ckd-text);z-index:2;display:grid;gap:.6rem;box-sizing:border-box}
.ckd[data-placement=overlay]{position:absolute;inset-inline:clamp(.5rem,2.5%,1.25rem);bottom:clamp(.5rem,2.5%,1.25rem)}
.ckd *{box-sizing:border-box}
.ckd-box{display:flex;gap:.85rem;align-items:flex-start;padding:clamp(.75rem,2.4vw,1.15rem) clamp(.85rem,2.6vw,1.35rem);border-radius:1rem;background:color-mix(in oklab,var(--ckd-surface) 86%,transparent);border:1px solid color-mix(in oklab,var(--ckd-speaker,var(--ckd-accent)) 45%,transparent);box-shadow:0 18px 40px -18px rgb(0 0 0/.55),inset 0 1px 0 rgb(255 255 255/.06);backdrop-filter:blur(10px)}
.ckd-portrait{width:clamp(3rem,10vw,4.75rem);aspect-ratio:1;object-fit:cover;border-radius:.8rem;border:2px solid var(--ckd-speaker,var(--ckd-accent));flex:none;background:color-mix(in oklab,var(--ckd-speaker,var(--ckd-accent)) 25%,transparent)}
.ckd-box[data-side=end]{flex-direction:row-reverse}
.ckd-body{min-width:0;flex:1;display:grid;gap:.3rem}
.ckd-name{margin:0;justify-self:start;font-weight:700;font-size:.82em;letter-spacing:.02em;padding:.1rem .6rem;border-radius:999px;color:var(--ckd-surface);background:var(--ckd-speaker,var(--ckd-accent))}
.ckd-name:empty{display:none}
.ckd-text{margin:0;line-height:1.65;font-size:clamp(.95rem,2.2vw,1.08rem);min-height:1.65em;overflow-wrap:anywhere}
.ckd-box[data-narration] .ckd-text{font-style:italic;color:var(--ckd-muted)}
.ckd-actions{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:flex-end}
.ckd-choices{display:grid;gap:.45rem}
.ckd-choices:empty,.ckd-actions:empty{display:none}
.ckd button{font:inherit;cursor:pointer;border-radius:.75rem;min-height:2.75rem;padding:.55rem 1rem;color:var(--ckd-text);background:color-mix(in oklab,var(--ckd-surface) 80%,var(--ckd-accent));border:1px solid color-mix(in oklab,var(--ckd-accent) 55%,transparent);text-align:start;transition:transform .15s ease,background-color .15s ease}
.ckd button:hover:not(:disabled){background:color-mix(in oklab,var(--ckd-surface) 60%,var(--ckd-accent))}
.ckd button:focus-visible{outline:3px solid var(--ckd-accent);outline-offset:2px}
.ckd button:disabled{opacity:.5;cursor:not-allowed}
.ckd-choice{display:flex;gap:.6rem;align-items:center}
.ckd-key{flex:none;display:inline-grid;place-items:center;width:1.6em;height:1.6em;border-radius:.45rem;font-size:.8em;font-weight:700;background:var(--ckd-accent);color:var(--ckd-surface)}
.ckd-primary{font-weight:700;background:var(--ckd-accent)!important;color:var(--ckd-surface)!important}
.ckd-log{font-size:.85em;color:var(--ckd-muted)}
.ckd-log summary{cursor:pointer;width:max-content}
.ckd-log ol{margin:.4rem 0 0;padding-inline-start:1.2rem;max-height:9rem;overflow:auto}
.ckd-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.ckd button{transition:none}}
`;

function labelsFor(
  root: HTMLElement,
  given: Partial<DialogueViewLabels> | undefined,
): DialogueViewLabels {
  const lang = (root.closest('[lang]')?.getAttribute('lang') ?? '').toLowerCase();
  return { ...(lang.startsWith('ar') ? AR : EN), ...(given ?? {}) };
}

/** Anything with appendChild can host the box; authored scene code may pass any value. */
function isMountable(value: unknown): value is HTMLElement {
  return (
    value !== undefined &&
    value !== null &&
    typeof (value as { appendChild?: unknown }).appendChild === 'function'
  );
}

export function createDialogueView(
  talk: DialogueLike,
  // Authored scene code is plain JavaScript: the options or their root may be missing.
  input: DialogueViewOptions | null | undefined,
): DialogueView {
  const mount: unknown = input?.root;
  if (input === null || input === undefined || !isMountable(mount)) {
    throw new TypeError('dialogue.view needs { root: HTMLElement }');
  }
  const options = input;
  const root = mount;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const labels = labelsFor(root, options.labels);
  const interactive = options.interactive !== false;
  const instant = options.reducedMotion === true || !interactive || (options.speed ?? 45) <= 0;
  const speed = Math.max(5, Math.min(400, options.speed ?? 45));
  const placement = options.placement ?? 'overlay';
  const cleanups: (() => void)[] = [];

  if (doc.getElementById(STYLE_ID) === null) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    // lib.dom types `head` as non-null, but a document without a <head> element has none.
    ((doc.head as HTMLHeadElement | null) ?? doc.documentElement).appendChild(style);
  }

  let restorePosition: string | undefined;
  if (placement === 'overlay' && win !== null && win.getComputedStyle(root).position === 'static') {
    restorePosition = root.style.position;
    root.style.position = 'relative';
  }

  const el = (tag: string, className: string): HTMLElement => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };
  const section = el('section', 'ckd');
  section.setAttribute('aria-label', labels.dialogue);
  section.dataset['placement'] = placement;
  const box = el('div', 'ckd-box');
  const portrait = doc.createElement('img');
  portrait.className = 'ckd-portrait';
  portrait.alt = '';
  portrait.hidden = true;
  const body = el('div', 'ckd-body');
  const name = el('p', 'ckd-name');
  const text = el('p', 'ckd-text');
  text.setAttribute('aria-hidden', 'true');
  const live = el('p', 'ckd-sr');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  body.append(name, text, live);
  box.append(portrait, body);
  const choices = el('div', 'ckd-choices');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', labels.choices);
  const actions = el('div', 'ckd-actions');
  const log = el('details', 'ckd-log') as HTMLDetailsElement;
  const summary = doc.createElement('summary');
  summary.textContent = labels.history;
  const list = doc.createElement('ol');
  log.append(summary, list);
  section.append(box, choices, actions, log);
  root.appendChild(section);

  let typing: number | undefined;
  let typed = 0;
  let full = '';

  function stopTyping(): void {
    if (typing !== undefined && win !== null) win.clearInterval(typing);
    typing = undefined;
  }

  function skip(): void {
    stopTyping();
    typed = full.length;
    text.textContent = full;
  }

  function type(value: string): void {
    stopTyping();
    full = value;
    typed = 0;
    if (instant || win === null || value.length === 0) {
      skip();
      return;
    }
    text.textContent = '';
    // Connected scripts (Arabic) reveal whole words so letters never show in the wrong joined form.
    const units = CONNECTED_SCRIPT.test(value) ? value.split(/(?<=\s)/u) : Array.from(value);
    const ends: number[] = [];
    units.reduce((sum, unit) => {
      ends.push(sum + unit.length);
      return sum + unit.length;
    }, 0);
    const began = Date.now();
    typing = win.setInterval(() => {
      const budget = Math.floor(((Date.now() - began) / 1000) * speed);
      let shown = 0;
      // `ends` has one entry per unit, so the fallbacks are never used.
      while (shown < units.length && (ends[shown] ?? Infinity) <= Math.max(budget, ends[0] ?? 0))
        shown += 1;
      if (shown === typed) return;
      text.textContent = units.slice(0, shown).join('');
      typed = shown;
      if (shown >= units.length) stopTyping();
    }, 33);
  }

  function focusInside(): boolean {
    return section.contains(doc.activeElement);
  }

  function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    node.addEventListener('click', () => {
      if (!interactive) return;
      onClick();
    });
    return node;
  }

  function act(fn: () => void): void {
    const hadFocus = focusInside();
    if (typing !== undefined) {
      skip();
      return;
    }
    fn();
    if (hadFocus) {
      const target = section.querySelector<HTMLButtonElement>(
        '.ckd-choice:not(:disabled), .ckd-primary',
      );
      target?.focus();
    }
  }

  function render(): void {
    const line = talk.current;
    section.style.setProperty('--ckd-speaker', line.color || 'var(--ckd-accent)');
    name.textContent = line.name;
    box.toggleAttribute('data-narration', line.name === '');
    box.dataset['side'] = line.character?.side ?? 'start';
    const src =
      options.portraits === false || line.character === undefined
        ? ''
        : (line.character.expressions[line.emotion] ?? line.character.portrait);
    portrait.hidden = src === '';
    if (src !== '' && portrait.getAttribute('src') !== src) portrait.src = src;
    const spoken = line.text === '' && line.ended ? labels.end : line.text;
    live.textContent = line.name === '' ? spoken : `${line.name}: ${spoken}`;
    type(spoken);

    choices.replaceChildren(
      ...line.choices.map((choice, order) => {
        const node = button('', 'ckd-choice', () => {
          act(() => talk.choose(choice.index));
        });
        const key = el('span', 'ckd-key');
        key.textContent = String(order + 1);
        key.setAttribute('aria-hidden', 'true');
        const label = doc.createElement('span');
        label.textContent = choice.text;
        node.append(key, label);
        node.disabled = !choice.enabled || !interactive;
        return node;
      }),
    );
    actions.replaceChildren();
    if (line.canAdvance)
      actions.append(
        button(labels.next, 'ckd-primary', () => {
          act(() => talk.advance());
        }),
      );
    else if (line.ended)
      actions.append(
        button(labels.restart, 'ckd-primary', () => {
          act(() => talk.restart());
        }),
      );
    for (const node of actions.querySelectorAll('button')) node.disabled = !interactive;

    list.replaceChildren(
      ...talk.history.slice(-50).map((entry) => {
        const item = doc.createElement('li');
        item.textContent = entry.name === '' ? entry.text : `${entry.name}: ${entry.text}`;
        return item;
      }),
    );
    options.onRender?.(line);
  }

  const onKey = (event: KeyboardEvent): void => {
    if (!interactive || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!/^[1-8]$/u.test(event.key)) return;
    const node = choices.querySelectorAll<HTMLButtonElement>('.ckd-choice')[Number(event.key) - 1];
    if (node !== undefined && !node.disabled) {
      event.preventDefault();
      node.click();
    }
  };
  section.addEventListener('keydown', onKey);
  cleanups.push(() => {
    section.removeEventListener('keydown', onKey);
  });
  cleanups.push(talk.on('line', render));
  cleanups.push(
    talk.on('change', () => {
      // Variables can unlock choices on the current line.
      if (talk.current.choices.length > 0) render();
    }),
  );

  if (!talk.started) talk.start();
  else render();

  return {
    element: section,
    render,
    skip,
    dispose() {
      stopTyping();
      for (const cleanup of cleanups.splice(0)) cleanup();
      section.remove();
      if (restorePosition !== undefined) root.style.position = restorePosition;
    },
  };
}
