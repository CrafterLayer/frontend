import type { Bilingual, CustomCodeNode } from '@craftkit/builder-schema';

import { bilingualTree, el, wordList, type KitLang, type KitRegion } from './define';

/*
  The section every game kit drives (2026-10-13). The world is designed at 1280 × 848: a 1280 × 720
  playfield (y 64…784) between two 64-unit bands, so the HUD row above and the control row below
  never cover play. The section keeps that aspect (≤ 1120 px wide, centred, so the kit's contain
  fit lines the world up with it); on a phone it grows taller — the playfield centred between two
  tall bands for the stats, the menu and a cross pad.

  Every word is element text or an aria-label here, in the page's language: the title, the
  objective, the button labels, the stat labels and the status lines (a hidden list the code reads
  by key). The hooks are the door's own: data-game-action / data-game-key / data-game-status and
  data-scene-part / data-scene-value.
*/

const w = (en: string, ar: string): Bilingual => ({ en, ar });

/** The words every game shares; a kit adds its own lines through `says`. */
export const GAME_WORDS = {
  start: w('Start', 'ابدأ'),
  pause: w('Pause', 'إيقاف مؤقت'),
  restart: w('Restart', 'من جديد'),
  sound: w('Sound', 'الصوت'),
  controls: w('Game controls', 'أزرار التحكم'),
  menu: w('Game menu', 'قائمة اللعبة'),
  stats: w('Game stats', 'أرقام اللعبة'),
} as const;

/** The status lines the shell reads by key (`ready` is also the status before the code runs). */
export const GAME_SAYS: Readonly<Record<string, Bilingual>> = {
  ready: w('Press Start to play.', 'اضغط «ابدأ» لتلعب.'),
  running: w('Game on!', 'بدأت اللعبة!'),
  paused: w('Paused.', 'اللعبة متوقفة مؤقتاً.'),
  won: w('You win!', 'لقد فزت!'),
  lost: w('Game over.', 'انتهت اللعبة.'),
  again: w('Play again', 'العب مجدداً'),
  resume: w('Resume', 'تابع'),
};

/** The direction keys, labelled for assistive technology; the glyphs carry no words. */
const KEYS: Readonly<Record<string, { glyph: string; label: Bilingual }>> = {
  ArrowLeft: { glyph: '←', label: w('Left', 'يسار') },
  ArrowRight: { glyph: '→', label: w('Right', 'يمين') },
  ArrowUp: { glyph: '↑', label: w('Up', 'أعلى') },
  ArrowDown: { glyph: '↓', label: w('Down', 'أسفل') },
};

export interface GameStat {
  readonly key: string;
  readonly label: Bilingual;
  /** The value shown before the code runs (and in the editor). */
  readonly value: string;
}

export interface GameTreeSpec {
  readonly title: Bilingual;
  /** The objective and the controls, in one or two sentences. */
  readonly intro: Bilingual;
  readonly stats: readonly GameStat[];
  /** Direction keys on the start side (physical order, never mirrored). */
  readonly keys: readonly ('ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown')[];
  /** A cross pad (up over left/down/right) on a phone instead of one row. */
  readonly cross?: boolean;
  /** Word buttons on the end side (Jump, Launch …): a key code each. */
  readonly actions?: readonly { readonly key: string; readonly label: Bilingual }[];
  /** The kit's own status lines, by key (merged over GAME_SAYS). */
  readonly says?: Readonly<Record<string, Bilingual>>;
  /** Extra nodes over the playfield after the card (the quiz's question panel). */
  readonly overlay?: (lang: KitLang) => readonly CustomCodeNode[];
  /** One more `ck-kit-*` class on the section, for a kit's own css. */
  readonly className?: string;
  /** No direction keys at all (a game played with its own DOM buttons). */
  readonly bare?: boolean;
}

function stat(lang: KitLang, entry: GameStat): CustomCodeNode {
  return el('p', 'ck-kit-stat', {}, [
    el('span', 'ck-kit-stat-label', {}, entry.label[lang]),
    el('b', 'ck-kit-stat-value', { 'data-scene-part': entry.key }, entry.value),
  ]);
}

function gameSection(spec: GameTreeSpec, lang: KitLang): CustomCodeNode {
  const says = { ...GAME_SAYS, ...(spec.says ?? {}) };
  const menu = el('div', 'ck-kit-menu', { role: 'group', 'aria-label': GAME_WORDS.menu[lang] }, [
    el(
      'button',
      'ck-kit-btn',
      { 'data-game-action': 'pause', 'aria-pressed': 'false', disabled: 'disabled' },
      GAME_WORDS.pause[lang],
    ),
    el('button', 'ck-kit-btn', { 'data-game-action': 'restart' }, GAME_WORDS.restart[lang]),
    el(
      'button',
      'ck-kit-btn',
      { 'data-game-action': 'sound', 'aria-pressed': 'false' },
      GAME_WORDS.sound[lang],
    ),
  ]);
  const hud = el('div', 'ck-kit-hud', {}, [
    el(
      'div',
      'ck-kit-stats',
      { role: 'group', 'aria-label': GAME_WORDS.stats[lang] },
      spec.stats.map((entry) => stat(lang, entry)),
    ),
    menu,
  ]);
  const card = el('div', 'ck-kit-card', { 'data-scene-part': 'card' }, [
    el('h2', 'ck-kit-title', { 'data-scene-part': 'title' }, spec.title[lang]),
    el('p', 'ck-kit-intro', { 'data-scene-part': 'intro' }, spec.intro[lang]),
    el('p', 'ck-kit-msg', { 'data-scene-part': 'message', hidden: 'hidden' }),
    el('button', 'ck-kit-go', { 'data-game-action': 'start' }, GAME_WORDS.start[lang]),
  ]);
  const controls: CustomCodeNode[] = [];
  if (spec.bare !== true) {
    const pad = el(
      'div',
      spec.cross === true ? 'ck-kit-pad ck-kit-cross' : 'ck-kit-pad',
      { role: 'group', 'aria-label': GAME_WORDS.controls[lang], dir: 'ltr' },
      spec.keys.map((code) =>
        el(
          'button',
          `ck-kit-key ck-kit-${code.slice('Arrow'.length).toLowerCase()}`,
          { 'data-game-key': code, 'aria-label': KEYS[code]?.label[lang] ?? code },
          KEYS[code]?.glyph ?? code,
        ),
      ),
    );
    const actions = (spec.actions ?? []).map((action) =>
      el('button', 'ck-kit-key ck-kit-act', { 'data-game-key': action.key }, action.label[lang]),
    );
    controls.push(
      el('div', 'ck-kit-controls', {}, [
        ...(spec.keys.length > 0 ? [pad] : []),
        ...(actions.length > 0
          ? [
              el(
                'div',
                'ck-kit-actions',
                { role: 'group', 'aria-label': GAME_WORDS.controls[lang] },
                actions,
              ),
            ]
          : []),
      ]),
    );
  }
  const classes = [
    'ck-kit',
    'ck-kit-game',
    ...(spec.className === undefined ? [] : [spec.className]),
  ];
  return el('section', classes.join(' '), { 'aria-label': spec.title[lang] }, [
    hud,
    card,
    ...(spec.overlay?.(lang) ?? []),
    ...controls,
    el(
      'p',
      'ck-kit-sr',
      { 'data-game-status': '', role: 'status', 'aria-live': 'polite' },
      says['ready']?.[lang] ?? '',
    ),
    wordList(lang, says),
  ]);
}

/**
 * The region css every game kit shares. Colours are the theme's tokens only (surface, text,
 * accent, muted) mixed with `color-mix`; sizes are relative so the section reads at 390 px.
 */
export const GAME_CSS = [
  '.ck-kit{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:1120px;margin-inline:auto;aspect-ratio:1280/848;color:var(--t-text);pointer-events:none;font:inherit;line-height:1.4}',
  '.ck-kit *{box-sizing:border-box}',
  '.ck-kit [hidden]{display:none!important}',
  '.ck-kit-hud{position:absolute;inset-inline:0;top:0;height:7.55%;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding-inline:clamp(.4rem,1.6%,1rem)}',
  '.ck-kit-stats,.ck-kit-menu{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}',
  '.ck-kit-stat{margin:0;display:flex;gap:.35em;align-items:baseline;padding:.2rem .7rem;border-radius:999px;background:color-mix(in oklab,var(--t-surface) 78%,var(--t-accent));font-size:clamp(.78rem,1.5vw,.95rem);white-space:nowrap}',
  '.ck-kit-stat-label{color:var(--t-text-muted)}',
  '.ck-kit-stat-value{font-variant-numeric:tabular-nums}',
  '.ck-kit button{pointer-events:auto;font:inherit;cursor:pointer;min-height:2.5rem;min-width:2.5rem;padding:.35rem .85rem;border-radius:.75rem;border:1px solid color-mix(in oklab,var(--t-accent) 45%,transparent);background:color-mix(in oklab,var(--t-surface) 84%,var(--t-accent));color:var(--t-text);touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:background-color .15s ease,transform .1s ease}',
  '.ck-kit button:hover:not(:disabled){background:color-mix(in oklab,var(--t-surface) 64%,var(--t-accent))}',
  '.ck-kit button:active:not(:disabled){transform:scale(.96)}',
  '.ck-kit button:focus-visible,.ck-kit-card :focus-visible{outline:3px solid var(--t-accent);outline-offset:2px}',
  '.ck-kit button:disabled{opacity:.45;cursor:not-allowed}',
  '.ck-kit button[aria-pressed=true]{background:var(--t-accent);color:var(--t-surface)}',
  '.ck-kit-btn{font-size:clamp(.78rem,1.5vw,.95rem)}',
  '.ck-kit-card{position:absolute;inset-inline:0;top:7.55%;bottom:7.55%;margin:auto;width:min(92%,30rem);height:fit-content;max-height:84.9%;overflow:auto;pointer-events:auto;display:grid;gap:.6rem;justify-items:center;text-align:center;padding:clamp(.9rem,3vw,1.75rem);border-radius:1.25rem;background:color-mix(in oklab,var(--t-surface) 90%,transparent);border:1px solid color-mix(in oklab,var(--t-accent) 38%,transparent);box-shadow:0 24px 60px -24px color-mix(in oklab,var(--t-text) 45%,transparent);backdrop-filter:blur(8px)}',
  '.ck-kit-title{margin:0;font-size:clamp(1.2rem,3.2vw,2rem);line-height:1.15}',
  '.ck-kit-intro{margin:0;color:var(--t-text-muted);font-size:clamp(.85rem,1.7vw,1rem)}',
  '.ck-kit-msg{margin:0;font-weight:700;font-size:clamp(1rem,2.2vw,1.25rem)}',
  '.ck-kit .ck-kit-go{background:var(--t-accent);color:var(--t-surface);font-weight:700;padding-inline:1.6rem;min-height:2.9rem}',
  '.ck-kit .ck-kit-go:hover:not(:disabled){background:color-mix(in oklab,var(--t-accent) 85%,var(--t-text))}',
  '.ck-kit-controls{position:absolute;inset-inline:0;bottom:0;height:7.55%;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding-inline:clamp(.4rem,1.6%,1rem)}',
  '.ck-kit-pad,.ck-kit-actions{display:flex;gap:.4rem;align-items:center}',
  '.ck-kit-key{font-size:1.15rem;line-height:1;touch-action:none}',
  '.ck-kit .ck-kit-act{font-size:clamp(.85rem,1.6vw,1rem);font-weight:700;min-width:5.5rem}',
  '.ck-kit-actions:only-child{margin-inline-start:auto}',
  '.ck-kit-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
  '.ck-kit canvas:focus-visible{outline:3px solid var(--t-accent);outline-offset:-3px}',
  '@media (max-width:820px){.ck-kit{aspect-ratio:auto;padding-block:7.5rem}.ck-kit::before{content:"";display:block;padding-top:56.25%}.ck-kit-hud{height:7.5rem;align-items:flex-start;flex-direction:column;justify-content:center}.ck-kit-controls{height:7.5rem}.ck-kit-card{top:7.5rem;bottom:7.5rem;max-height:calc(100% - 15rem)}.ck-kit-key{min-width:3.1rem;min-height:3.1rem}.ck-kit-cross{display:grid;grid-template-columns:repeat(3,3.1rem);grid-template-rows:repeat(2,3.1rem);gap:.3rem}.ck-kit-cross .ck-kit-up{grid-column:2;grid-row:1}.ck-kit-cross .ck-kit-left{grid-column:1;grid-row:2}.ck-kit-cross .ck-kit-down{grid-column:2;grid-row:2}.ck-kit-cross .ck-kit-right{grid-column:3;grid-row:2}.ck-kit .ck-kit-act{min-height:3.4rem;min-width:6.5rem}}',
  '@media (prefers-reduced-motion:reduce){.ck-kit button{transition:none}.ck-kit button:active:not(:disabled){transform:none}}',
].join('\n');

/** A game kit's region: its section in English and Arabic, and the shared css. */
export function gameRegion(spec: GameTreeSpec, extraCss = ''): KitRegion {
  return {
    tree: bilingualTree((lang) => gameSection(spec, lang)),
    css: extraCss === '' ? GAME_CSS : `${GAME_CSS}\n${extraCss}`,
  };
}
