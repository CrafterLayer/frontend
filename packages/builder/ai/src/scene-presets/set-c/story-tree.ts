import type { Bilingual, CustomCodeNode } from '@craftkit/builder-schema';

import { bilingualTree, el, wordList, type KitLang, type KitRegion } from './define';

/*
  The sections the story kits drive (2026-10-13). The story's words ARE the tree: each page or
  chapter is an element carrying its mood token (`data-scene-part="page"|"chapter"`,
  `data-scene-value="night"`), its heading and its text — so a person edits, adds or reorders
  pages in Layers, page.translate translates them, and the code only shows, hides and paints.
*/

const w = (en: string, ar: string): Bilingual => ({ en, ar });

/** One page or chapter: the landscape mood its picture shows, and its words. */
export interface StoryPage {
  readonly mood: string;
  readonly title: Bilingual;
  readonly text: Bilingual;
}

const STORY_WORDS = {
  nav: w('Story navigation', 'التنقل في القصة'),
  back: w('Previous', 'السابق'),
  next: w('Next', 'التالي'),
  reset: w('Start again', 'من البداية'),
  voice: w('Read aloud', 'اقرأ بصوت عالٍ'),
} as const;

/** The css every story kit shares: tokens only, the stage over the canvas, readable panels. */
const STORY_BASE_CSS = [
  '.ck-kit{position:relative;z-index:1;box-sizing:border-box;width:100%;max-width:1120px;margin-inline:auto;color:var(--t-text);pointer-events:none;font:inherit;line-height:1.55}',
  '.ck-kit *{box-sizing:border-box}',
  '.ck-kit [hidden]{display:none!important}',
  '.ck-kit-panel{pointer-events:auto;display:grid;gap:.5rem;padding:clamp(.9rem,2.4vw,1.5rem);border-radius:1.25rem;background:color-mix(in oklab,var(--t-surface) 88%,transparent);border:1px solid color-mix(in oklab,var(--t-accent) 30%,transparent);box-shadow:0 24px 60px -28px color-mix(in oklab,var(--t-text) 40%,transparent);backdrop-filter:blur(8px)}',
  '.ck-kit-eyebrow{margin:0;font-size:.8rem;font-weight:600;letter-spacing:.05em;color:var(--t-text-muted)}',
  '.ck-kit-page h2,.ck-kit-chapter h2{margin:0 0 .25rem;font-size:clamp(1.15rem,2.6vw,1.75rem);line-height:1.2}',
  '.ck-kit-page p,.ck-kit-chapter p{margin:0;font-size:clamp(.95rem,1.8vw,1.1rem)}',
  '.ck-kit-nav{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}',
  '.ck-kit button{pointer-events:auto;font:inherit;cursor:pointer;min-height:2.6rem;padding:.4rem .95rem;border-radius:.75rem;border:1px solid color-mix(in oklab,var(--t-accent) 45%,transparent);background:color-mix(in oklab,var(--t-surface) 84%,var(--t-accent));color:var(--t-text);transition:background-color .15s ease}',
  '.ck-kit button:hover:not(:disabled){background:color-mix(in oklab,var(--t-surface) 64%,var(--t-accent))}',
  '.ck-kit button:focus-visible{outline:3px solid var(--t-accent);outline-offset:2px}',
  '.ck-kit button:disabled{opacity:.45;cursor:not-allowed}',
  '.ck-kit button[aria-pressed=true]{background:var(--t-accent);color:var(--t-surface)}',
  '.ck-kit .ck-kit-go{background:var(--t-accent);color:var(--t-surface);font-weight:700}',
  '.ck-kit-status{margin:0;font-size:.85rem;color:var(--t-text-muted)}',
  '.ck-kit-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
  '@media (prefers-reduced-motion:reduce){.ck-kit button{transition:none}}',
].join('\n');

function nav(lang: KitLang, voice: boolean): CustomCodeNode {
  return el('div', 'ck-kit-nav', { role: 'group', 'aria-label': STORY_WORDS.nav[lang] }, [
    el('button', '', { 'data-story-action': 'back', disabled: 'disabled' }, STORY_WORDS.back[lang]),
    el('button', 'ck-kit-go', { 'data-story-action': 'next' }, STORY_WORDS.next[lang]),
    el('button', '', { 'data-story-action': 'reset' }, STORY_WORDS.reset[lang]),
    ...(voice
      ? [
          el(
            'button',
            '',
            { 'data-story-voice': '', 'aria-pressed': 'false' },
            STORY_WORDS.voice[lang],
          ),
        ]
      : []),
  ]);
}

// ── The picture book ──────────────────────────────────────────────────────────

export interface BookSpec {
  readonly title: Bilingual;
  readonly pages: readonly StoryPage[];
}

const BOOK_CSS = [
  '.ck-kit-book{aspect-ratio:16/9}',
  '.ck-kit-book .ck-kit-panel{position:absolute;inset-inline-start:3%;bottom:5%;width:min(50%,32rem)}',
  '@media (max-width:820px){.ck-kit-book{aspect-ratio:auto}.ck-kit-book::before{content:"";display:block;padding-top:56.25%}.ck-kit-book .ck-kit-panel{position:relative;inset:auto;width:auto;margin:.75rem}}',
].join('\n');

export function bookRegion(spec: BookSpec): KitRegion {
  return {
    tree: bilingualTree((lang) => {
      const total = spec.pages.length;
      return el('section', 'ck-kit ck-kit-book', { 'aria-label': spec.title[lang] }, [
        el('div', 'ck-kit-panel', {}, [
          el('p', 'ck-kit-eyebrow', { 'data-scene-part': 'title' }, spec.title[lang]),
          ...spec.pages.map((page, at) =>
            el(
              'article',
              'ck-kit-page',
              {
                'data-scene-part': 'page',
                'data-scene-value': page.mood,
                ...(at === 0 ? {} : { hidden: 'hidden' }),
              },
              [
                el('h2', '', { 'data-story-title': '' }, page.title[lang]),
                el('p', '', { 'data-story-copy': '' }, page.text[lang]),
              ],
            ),
          ),
          nav(lang, true),
          el(
            'p',
            'ck-kit-status',
            { 'data-story-status': '', role: 'status', 'aria-live': 'polite' },
            lang === 'ar' ? `الصفحة 1 من ${String(total)}` : `Page 1 of ${String(total)}`,
          ),
        ]),
        wordList(lang, { page: w('Page', 'الصفحة'), of: w('of', 'من') }),
      ]);
    }),
    css: `${STORY_BASE_CSS}\n${BOOK_CSS}`,
  };
}

// ── The visual novel ──────────────────────────────────────────────────────────

export interface NovelLine {
  readonly node?: string;
  readonly speaker: string;
  readonly text: Bilingual;
  readonly ending?: string;
  readonly next?: string;
  readonly choices?: readonly { readonly to: string; readonly text: Bilingual }[];
}

export interface NovelSpec {
  readonly title: Bilingual;
  readonly intro: Bilingual;
  readonly start: Bilingual;
  readonly cast: readonly { readonly id: string; readonly name: Bilingual }[];
  readonly lines: readonly NovelLine[];
  readonly says: Readonly<Record<string, Bilingual>>;
}

const NOVEL_CSS = [
  '.ck-kit-novel{aspect-ratio:16/9}',
  '.ck-kit-novel .ckd{pointer-events:auto}',
  '.ck-kit-novel .ck-kit-panel{position:absolute;inset:0;margin:auto;width:min(90%,30rem);height:fit-content;max-height:92%;overflow:auto;justify-items:center;text-align:center}',
  '.ck-kit-novel h2{margin:0;font-size:clamp(1.25rem,3vw,2rem);line-height:1.15}',
  '.ck-kit-novel .ck-kit-panel p{margin:0;color:var(--t-text-muted)}',
  '@media (max-width:820px){.ck-kit-novel{aspect-ratio:auto;padding-bottom:16rem}.ck-kit-novel::before{content:"";display:block;padding-top:56.25%}.ck-kit-novel .ck-kit-panel{bottom:auto;top:.75rem}}',
].join('\n');

export function novelRegion(spec: NovelSpec): KitRegion {
  return {
    tree: bilingualTree((lang) =>
      el(
        'section',
        'ck-kit ck-kit-novel',
        { 'aria-label': spec.title[lang], 'data-scene-part': 'stage' },
        [
          el('div', 'ck-kit-panel', { 'data-scene-part': 'card' }, [
            el('h2', '', { 'data-story-title': '' }, spec.title[lang]),
            el('p', '', { 'data-story-copy': '' }, spec.intro[lang]),
            el('button', 'ck-kit-go', { 'data-story-action': 'start' }, spec.start[lang]),
          ]),
          el(
            'ol',
            '',
            { 'data-ck-dialogue': '', hidden: 'hidden' },
            spec.lines.map((line) =>
              el(
                'li',
                '',
                {
                  ...(line.node === undefined ? {} : { 'data-ck-node': line.node }),
                  'data-ck-speaker': line.speaker,
                  ...(line.next === undefined ? {} : { 'data-ck-next': line.next }),
                  ...(line.ending === undefined ? {} : { 'data-ck-ending': line.ending }),
                },
                line.choices === undefined
                  ? line.text[lang]
                  : [
                      el('span', '', {}, line.text[lang]),
                      ...line.choices.map((choice) =>
                        el('button', '', { 'data-ck-next': choice.to }, choice.text[lang]),
                      ),
                    ],
              ),
            ),
          ),
          el(
            'ul',
            'ck-kit-words',
            { hidden: 'hidden', 'data-scene-part': 'cast' },
            spec.cast.map((member) =>
              el('li', '', { 'data-scene-value': member.id }, member.name[lang]),
            ),
          ),
          el('p', 'ck-kit-sr', { 'data-story-status': '', role: 'status', 'aria-live': 'polite' }),
          wordList(lang, spec.says),
        ],
      ),
    ),
    css: `${STORY_BASE_CSS}\n${NOVEL_CSS}`,
  };
}

// ── The scroll story ──────────────────────────────────────────────────────────

export interface ScrollSpec {
  readonly title: Bilingual;
  readonly hint: Bilingual;
  readonly chapters: readonly StoryPage[];
}

const SCROLL_CSS = [
  '.ck-kit-scroll{display:flex;flex-direction:column}',
  '.ck-kit-chapter{position:relative;min-height:clamp(26rem,56.25vw,40rem);display:flex;align-items:center;padding:clamp(1rem,4vw,3rem)}',
  '.ck-kit-chapter .ck-kit-panel{width:min(100%,30rem)}',
  '.ck-kit-chapter:nth-of-type(even) .ck-kit-panel{margin-inline-start:auto}',
  '.ck-kit-hint{margin:0;font-size:.85rem;color:var(--t-text-muted)}',
  '@media (max-width:820px){.ck-kit-chapter{min-height:30rem;align-items:flex-start}}',
].join('\n');

export function scrollRegion(spec: ScrollSpec): KitRegion {
  return {
    tree: bilingualTree((lang) =>
      el('section', 'ck-kit ck-kit-scroll', { 'aria-label': spec.title[lang] }, [
        ...spec.chapters.map((chapter, at) =>
          el(
            'article',
            'ck-kit-chapter',
            { 'data-scene-part': 'chapter', 'data-scene-value': chapter.mood },
            [
              el('div', 'ck-kit-panel', {}, [
                ...(at === 0 ? [el('p', 'ck-kit-eyebrow', {}, spec.title[lang])] : []),
                el('h2', '', { 'data-story-title': '' }, chapter.title[lang]),
                el('p', '', { 'data-story-copy': '' }, chapter.text[lang]),
                ...(at === 0 ? [el('p', 'ck-kit-hint', {}, spec.hint[lang])] : []),
              ]),
            ],
          ),
        ),
        el(
          'p',
          'ck-kit-sr',
          { 'data-story-status': '', role: 'status', 'aria-live': 'polite' },
          lang === 'ar'
            ? `الفصل 1 من ${String(spec.chapters.length)}`
            : `Chapter 1 of ${String(spec.chapters.length)}`,
        ),
        wordList(lang, { chapter: w('Chapter', 'الفصل'), of: w('of', 'من') }),
      ]),
    ),
    css: `${STORY_BASE_CSS}\n${SCROLL_CSS}`,
  };
}
