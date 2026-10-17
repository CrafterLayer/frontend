/**
 * View fixtures for the composer family's stories and tests (WP-14): Composer, RunBar,
 * StopButton, QueueHeader, ContextChip, MentionMenu, ComposerToolbar, ModeMenu, ModelMenu,
 * SendButton, EnhanceButton, EnhanceNote, ClarifyPanel.
 *
 * Views only, in both locales, written the way the controller writes them: the person's
 * own words (a draft, a queued request) in the person's register, everything the
 * instrument says left to the catalog. Nothing here counts a noun in Arabic; a count is a
 * number the component formats.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ComposerActions, ComposerView } from '../components/Composer/Composer';
import { consumeMentionFragment, mentionQuery } from '../model/mentions';
import { modelSelection } from '../model/model-label';
import { sendState, type RunLife } from '../model/send-state';
import type {
  AssistantMode,
  BlockChipView,
  ClarifyQuestionView,
  ClarifyView,
  ContextChipView,
  EnhancementView,
  Locale,
  MentionView,
  ModelSelectionView,
  QueueStatus,
  QueueView,
  RunBarView,
  ScopeChipView,
  StatusKey,
  CopyParams,
} from '../model/view-types';

/* ── Chips ─────────────────────────────────────────────────────────────────── */

/** The "Whole page" scope chip (FR-024): what a request with no selection is about. */
export const SCOPE_CHIP: ScopeChipView = { kind: 'page', id: 'scope:page' };

const BLOCK_LABELS: Readonly<Record<Locale, Readonly<Record<'hero' | 'services' | 'faq', string>>>> =
  {
    ar: { hero: 'الواجهة', services: 'الخدمات', faq: 'الأسئلة الشائعة' },
    en: { hero: 'Hero', services: 'Services', faq: 'FAQ' },
  };

/** A block chip for one of the fixture page's sections. */
export function blockChip(
  locale: Locale,
  block: 'hero' | 'services' | 'faq',
  overrides: Partial<BlockChipView> = {},
): BlockChipView {
  return {
    kind: 'selection',
    id: `node-${block}`,
    label: BLOCK_LABELS[locale][block],
    stale: false,
    ...overrides,
  };
}

/** A label long enough to meet the chip's 16-character ellipsis. */
export const LONG_LABEL: Readonly<Record<Locale, string>> = {
  ar: 'قسم آراء المرضى وقصص النجاح',
  en: 'Patient stories and reviews',
};

/* ── The person's words ────────────────────────────────────────────────────── */

/** A draft as a person types it, in each locale. */
export const DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'اجعل الترويسة ثابتة عند التمرير',
  en: 'Make the header sticky',
};

/** An English request typed into the Arabic panel: the box's direction follows the words. */
export const LATIN_DRAFT = 'Build a site for a coffee roaster in Irbid';

/** An Arabic request typed into the English panel. */
export const ARABIC_DRAFT = 'صفحة لمقهى مختص في إربد';

/** A draft long enough to pass six lines and scroll. */
export const LONG_DRAFT: Readonly<Record<Locale, string>> = {
  ar: [
    'صفحة لعيادة أسنان في عمّان.',
    'ترويسة فيها الشعار ورقم الهاتف.',
    'واجهة بصورة للعيادة وزر حجز عبر واتساب.',
    'قسم للخدمات: تقويم وزراعة وتبييض.',
    'قسم للأطباء مع صورهم.',
    'آراء المرضى، ثم الأسئلة الشائعة.',
    'وفي الأسفل الخريطة ومواعيد الدوام.',
  ].join('\n'),
  en: [
    'A page for a dental clinic in Amman.',
    'A header with the logo and the phone number.',
    'A hero with a photo of the clinic and a WhatsApp booking button.',
    'Services: braces, implants and whitening.',
    'The doctors, with their photos.',
    'Patient reviews, then the FAQ.',
    'At the bottom, the map and opening hours.',
  ].join('\n'),
};

/* ── The run ───────────────────────────────────────────────────────────────── */

/** How long the fixture run has been going when a story opens: the clock reads 1:12. */
export const RUN_AGE_MS = 72_000;

/**
 * A live run for the RunBar: by default four sections being written (SPEC §3.4). The
 * clock is measured from `now`, which a story passes as the moment it renders.
 */
export function liveRun(
  now: number,
  statusKey: StatusKey = 'build.writing',
  params: CopyParams = { n: 4 },
  overrides: Partial<RunBarView> = {},
): RunBarView {
  return {
    turnId: 'turn-build',
    activity: statusKey.startsWith('edit.') ? 'edit' : 'build',
    statusKey,
    params,
    startedAt: now - RUN_AGE_MS,
    stopping: false,
    ...overrides,
  };
}

/** The same run after Stop was pressed and before the engine settled (SPEC §3.10). */
export function stoppingRun(now: number): RunBarView {
  return liveRun(now, 'stopping', {}, { stopping: true });
}

/* ── The queue ─────────────────────────────────────────────────────────────── */

/** The one queued request, in any of its four states (SPEC §3.9, §3.10). */
export function queued(locale: Locale, status: QueueStatus = 'editable'): QueueView {
  return {
    text: DRAFT[locale],
    chips: status === 'paused' ? [blockChip(locale, 'hero')] : [SCOPE_CHIP],
    status,
  };
}

/* ── Mentions ──────────────────────────────────────────────────────────────── */

/** The `@` list, open on a fragment, sections first with their place (SPEC §3.2). */
export const MENTION: Readonly<Record<Locale, MentionView>> = {
  ar: {
    query: 'ال',
    candidates: [
      { id: 'node-hero', label: 'الواجهة', section: { position: 2, total: 8 } },
      { id: 'node-services', label: 'الخدمات', section: { position: 3, total: 8 } },
      { id: 'node-doctors', label: 'الأطباء', section: { position: 5, total: 8 } },
      { id: 'node-booking', label: 'الحجز عبر واتساب' },
    ],
  },
  en: {
    query: 'se',
    candidates: [
      { id: 'node-services', label: 'Services', section: { position: 3, total: 8 } },
      { id: 'node-social', label: 'Social proof', section: { position: 6, total: 8 } },
      { id: 'node-session', label: 'Session prices' },
    ],
  },
};

/** An `@` fragment that matches nothing. */
export const MENTION_EMPTY: Readonly<Record<Locale, MentionView>> = {
  ar: { query: 'سعر', candidates: [] },
  en: { query: 'pricing', candidates: [] },
};

/* ── Models ────────────────────────────────────────────────────────────────── */

/** The ids a host offers, raw: the menu must never show them. */
export const MODEL_IDS = ['cli:haiku', 'cli:sonnet', 'minimax/minimax-m3:free'] as const;

function requireSelection(selection: ModelSelectionView | null): ModelSelectionView {
  if (selection === null) throw new Error('the fixture ids must offer a choice');
  return selection;
}

/** The picker, through `model-label.ts`, with the fast model chosen. */
export const MODEL: ModelSelectionView = requireSelection(modelSelection(MODEL_IDS, 'cli:haiku'));

/* ── ✨ Improve ─────────────────────────────────────────────────────────────── */

/** The draft before Improve, as the owner might type it. */
export const ROUGH_DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'خلي الهيرو اغمق وحط زر واتس',
  en: 'make hero darker + whatsapp btn',
};

/** The rewrite Improve puts in the box. */
export const IMPROVED_DRAFT: Readonly<Record<Locale, string>> = {
  ar: 'اجعل خلفية قسم الواجهة أغمق، وأضف زر حجز عبر واتساب أسفل العنوان.',
  en: 'Make the hero background darker and add a WhatsApp booking button below the headline.',
};

/** Every Improve state (the view's union), per locale. */
export function enhancement(
  locale: Locale,
  status: EnhancementView['status'],
): EnhancementView {
  switch (status) {
    case 'unavailable':
    case 'idle':
    case 'enhancing':
      return { status };
    case 'failed':
      return { status, reason: 'unreachable' };
    case 'enhanced':
      return locale === 'ar'
        ? {
            status,
            understood: 'واجهة أغمق مع زر حجز عبر واتساب',
            changes: [
              'سُمّي القسم باسمه: الواجهة',
              'حُدّد مكان الزر: أسفل العنوان',
              'صُحّحت كتابة «واتساب»',
            ],
            canRestore: true,
          }
        : {
            status,
            understood: 'A darker hero with a WhatsApp booking button',
            changes: [
              'Named the section: the hero',
              'Placed the button below the headline',
              'Spelled out “button”',
            ],
            canRestore: true,
          };
  }
}

/* ── Questions before guessing ─────────────────────────────────────────────── */

const QUESTIONS: Readonly<Record<Locale, readonly ClarifyQuestionView[]>> = {
  ar: [
    { id: 'q-page', text: 'أي صفحة يفتحها الرابط؟', choices: ['الخدمات', 'تواصل معنا', 'الحجز'] },
    {
      id: 'q-place',
      text: 'أين يوضع الرابط؟',
      choices: ['في الترويسة', 'في الواجهة', 'في آخر الصفحة'],
    },
    { id: 'q-look', text: 'كيف يظهر؟', choices: ['زر', 'رابط نصي'] },
  ],
  en: [
    {
      id: 'q-page',
      text: 'Which page should the link open?',
      choices: ['Services', 'Contact us', 'Booking'],
    },
    {
      id: 'q-place',
      text: 'Where should the link go?',
      choices: ['In the header', 'In the hero', 'At the end of the page'],
    },
    { id: 'q-look', text: 'How should it look?', choices: ['A button', 'A text link'] },
  ],
};

/** The owner's own unclear request (2026-09-28), and an English one like it. */
export const UNCLEAR_REQUEST: Readonly<Record<Locale, string>> = {
  ar: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
  en: 'can u link this page to the one inside',
};

/**
 * The questions docked for an unclear request: `count` of them (1 to 3), the first
 * `answered` already answered, asking or rewriting.
 */
export function clarifying(
  locale: Locale,
  count: 1 | 2 | 3 = 3,
  answered = 0,
  status: ClarifyView['status'] = 'asking',
): ClarifyView {
  return {
    request: UNCLEAR_REQUEST[locale],
    understood:
      locale === 'ar'
        ? 'إضافة رابط من هذه الصفحة إلى صفحة داخلية'
        : 'Add a link from this page to an inner page',
    questions: QUESTIONS[locale].slice(0, count).map((question, index) =>
      index < answered ? { ...question, answer: question.choices[0] } : question,
    ),
    status,
  };
}

/* ── The whole composer ────────────────────────────────────────────────────── */

/**
 * The Composer's view, with the Send slot worked out the way the controller works it out
 * (`sendState`), so a fixture can never draw a Send state its draft and run contradict.
 */
export function composerView(overrides: Partial<ComposerView> = {}): ComposerView {
  const base: ComposerView = {
    locale: 'en',
    draft: '',
    chips: [SCOPE_CHIP],
    mention: null,
    mode: 'auto',
    model: MODEL,
    send: 'idle-empty',
    run: null,
    queue: null,
    enhancement: { status: 'idle' },
    clarify: null,
  };
  const view = { ...base, ...overrides };
  return overrides.send === undefined ? settleSend(view) : view;
}

/** The Send slot for a view's draft, run and queue, as `model/send-state.ts` decides it. */
export function settleSend(view: ComposerView): ComposerView {
  const life: RunLife = view.run === null ? 'idle' : view.run.stopping ? 'stopping' : 'live';
  const isQueued =
    view.queue !== null && view.queue.status !== 'paused' && view.queue.text === view.draft;
  return { ...view, send: sendState({ run: life, draft: view.draft, queued: isQueued }) };
}

/** The chips a locale's fixture view carries by default. */
export function chipsFor(locale: Locale, ...blocks: ('hero' | 'services' | 'faq')[]): readonly ContextChipView[] {
  return blocks.length === 0 ? [SCOPE_CHIP] : blocks.map((block) => blockChip(locale, block));
}

/**
 * Actions that do nothing: a story or a test spreads it and replaces the ones it watches
 * (`{ ...NO_ACTIONS, send: vi.fn() }`), so every one it does not care about still exists.
 */
export const NO_ACTIONS: ComposerActions = {
  setDraft: () => undefined,
  send: () => undefined,
  stop: () => undefined,
  removeQueued: () => undefined,
  continueQueued: () => undefined,
  removeChip: () => undefined,
  addMention: () => undefined,
  setMode: () => undefined,
  setModel: () => undefined,
  enhanceDraft: () => undefined,
  restoreDraft: () => undefined,
  answerClarify: () => undefined,
  sendAsWritten: () => undefined,
  dismissClarify: () => undefined,
  setComposerFocused: () => undefined,
};

/* ── A composer that moves: stories and behaviour tests ────────────────────── */

/** The fixture page's blocks, as the `@` list offers them (sections first, with a place). */
const PAGE_BLOCKS: Readonly<Record<Locale, readonly MentionView['candidates'][number][]>> = {
  ar: [
    { id: 'node-header', label: 'الترويسة', section: { position: 1, total: 8 } },
    ...MENTION.ar.candidates,
    { id: 'node-faq', label: 'الأسئلة الشائعة', section: { position: 7, total: 8 } },
  ],
  en: [
    { id: 'node-hero', label: 'Hero', section: { position: 2, total: 8 } },
    ...MENTION.en.candidates,
    { id: 'node-faq', label: 'FAQ', section: { position: 7, total: 8 } },
  ],
};

/** The `@` list for a draft, the way the controller derives it: `null` when none is open. */
export function mentionFor(locale: Locale, draft: string): MentionView | null {
  const query = mentionQuery(draft);
  if (query === null) return null;
  const folded = query.toLocaleLowerCase(locale);
  return {
    query,
    candidates: PAGE_BLOCKS[locale].filter((candidate) =>
      candidate.label.toLocaleLowerCase(locale).includes(folded),
    ),
  };
}

/** A run that has just started: the moment before its intent is known. */
function startedRun(): RunBarView {
  const now = Date.now();
  return liveRun(now, 'run.understanding', {}, { activity: 'routing', startedAt: now });
}

export interface ComposerFixtureOptions {
  /**
   * How long Stop takes to settle before the run ends; `null` (the default) never settles
   * by itself, so a test ends the run with `set({ run: null })` at the moment it chooses.
   */
  readonly stopSettlesMs?: number | null | undefined;
  /** How long ✨ Improve works before the rewrite lands; `null` never lands by itself. */
  readonly enhanceMs?: number | null | undefined;
  /** How long the answers take to rewrite the request; `null` never finishes by itself. */
  readonly rewriteMs?: number | null | undefined;
  /** Called after each action moved the view: a test's spies, a story's `fn()`s. */
  readonly spy?: Partial<ComposerActions> | undefined;
}

export interface ComposerFixture {
  readonly view: ComposerView;
  readonly actions: ComposerActions;
  /** Moves the view from outside, as the engine would (a run ending, a queue revalidated). */
  readonly set: (patch: Partial<ComposerView>) => void;
}

/**
 * A Composer's view and actions that behave the way the controller does for everything
 * the composer can show on its own: typing (the `@` list follows the draft; a queued
 * request's text IS the draft), Send (clears the box; while a run is live it queues the
 * draft instead), Stop (stopping, then the run ends and a waiting request pauses), the
 * chips, the menus, ✨ Improve and Restore, and the clarifying questions. The Send slot is
 * always recomputed through `sendState`, so a harness can never draw a slot its draft and
 * run contradict. Nothing here imports vitest: stories load it in the browser.
 */
export function useComposerFixture(
  initial: ComposerView,
  options: ComposerFixtureOptions = {},
): ComposerFixture {
  const { stopSettlesMs = null, enhanceMs = null, rewriteMs = null, spy } = options;
  const [view, setView] = useState(() => settleSend(initial));
  const spyRef = useRef(spy);
  useEffect(() => {
    spyRef.current = spy;
  });
  const original = useRef<string | null>(null);

  const move = useCallback((next: (current: ComposerView) => ComposerView) => {
    setView((current) => settleSend(next(current)));
  }, []);
  const set = useCallback(
    (patch: Partial<ComposerView>) => {
      move((current) => ({ ...current, ...patch }));
    },
    [move],
  );

  /* Timers the engine would drive: a stop settling, Improve landing, answers rewriting. */
  const stopping = view.run?.stopping === true;
  useEffect(() => {
    if (!stopping || stopSettlesMs === null) return;
    const timer = setTimeout(() => {
      move((current) => ({
        ...current,
        run: null,
        // A request waiting behind a stopped run pauses with its own text (SPEC §3.10).
        queue: current.queue === null ? null : { ...current.queue, status: 'paused' },
        draft: current.queue === null ? current.draft : '',
        mention: null,
      }));
    }, stopSettlesMs);
    return () => {
      clearTimeout(timer);
    };
  }, [stopping, stopSettlesMs, move]);

  const enhancing = view.enhancement.status === 'enhancing';
  useEffect(() => {
    if (!enhancing || enhanceMs === null) return;
    const timer = setTimeout(() => {
      move((current) => ({
        ...current,
        draft: IMPROVED_DRAFT[current.locale],
        mention: null,
        enhancement: enhancement(current.locale, 'enhanced'),
      }));
    }, enhanceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [enhancing, enhanceMs, move]);

  const rewriting = view.clarify?.status === 'rewriting';
  useEffect(() => {
    if (!rewriting || rewriteMs === null) return;
    const timer = setTimeout(() => {
      move((current) => ({
        ...current,
        clarify: null,
        run: startedRun(),
      }));
    }, rewriteMs);
    return () => {
      clearTimeout(timer);
    };
  }, [rewriting, rewriteMs, move]);

  const actions: ComposerActions = {
    setDraft: (text) => {
      move((current) => {
        const { queue } = current;
        // Editing the text edits the queued request; emptying the box drops it (FR-025).
        const nextQueue =
          queue === null || queue.status === 'paused' || queue.text !== current.draft
            ? queue
            : text.trim() === ''
              ? null
              : { ...queue, text };
        return {
          ...current,
          draft: text,
          mention: mentionFor(current.locale, text),
          queue: nextQueue,
          enhancement:
            current.enhancement.status === 'unavailable' ? current.enhancement : { status: 'idle' },
        };
      });
      spyRef.current?.setDraft?.(text);
    },
    send: () => {
      move((current) => {
        if (current.draft.trim() === '') return current;
        if (current.run !== null) {
          if (current.queue !== null && current.queue.status !== 'paused') return current;
          return {
            ...current,
            queue: { text: current.draft, chips: current.chips, status: 'editable' },
          };
        }
        return {
          ...current,
          draft: '',
          chips: [SCOPE_CHIP],
          mention: null,
          enhancement:
            current.enhancement.status === 'unavailable' ? current.enhancement : { status: 'idle' },
          run: startedRun(),
        };
      });
      spyRef.current?.send?.();
    },
    stop: () => {
      move((current) =>
        current.run === null ? current : { ...current, run: { ...current.run, stopping: true } },
      );
      spyRef.current?.stop?.();
    },
    removeQueued: () => {
      move((current) => {
        if (current.queue === null) return current;
        const heldTheDraft = current.queue.status !== 'paused';
        return { ...current, queue: null, draft: heldTheDraft ? '' : current.draft };
      });
      spyRef.current?.removeQueued?.();
    },
    continueQueued: () => {
      move((current) => ({
        ...current,
        queue: null,
        run: startedRun(),
      }));
      spyRef.current?.continueQueued?.();
    },
    removeChip: (id) => {
      move((current) => {
        const chips = current.chips.filter((chip) => chip.id !== id);
        return { ...current, chips: chips.length === 0 ? [SCOPE_CHIP] : chips };
      });
      spyRef.current?.removeChip?.(id);
    },
    addMention: (nodeId) => {
      move((current) => {
        const candidate = PAGE_BLOCKS[current.locale].find((block) => block.id === nodeId);
        if (candidate === undefined) return current;
        const blocks = current.chips.filter(
          (chip): chip is BlockChipView => chip.kind !== 'page' && chip.id !== nodeId,
        );
        return {
          ...current,
          draft: consumeMentionFragment(current.draft).text,
          mention: null,
          chips: [...blocks, { kind: 'mention', id: nodeId, label: candidate.label, stale: false }],
        };
      });
      spyRef.current?.addMention?.(nodeId);
    },
    setMode: (mode: AssistantMode) => {
      move((current) => ({ ...current, mode }));
      spyRef.current?.setMode?.(mode);
    },
    setModel: (id) => {
      move((current) => ({ ...current, model: modelSelection(MODEL_IDS, id) }));
      spyRef.current?.setModel?.(id);
    },
    enhanceDraft: () => {
      move((current) => {
        if (current.draft.trim() === '' || current.enhancement.status === 'unavailable') {
          return current;
        }
        original.current = current.draft;
        return { ...current, mention: null, enhancement: { status: 'enhancing' } };
      });
      spyRef.current?.enhanceDraft?.();
    },
    restoreDraft: () => {
      move((current) => ({
        ...current,
        draft: original.current ?? current.draft,
        mention: null,
        enhancement: { status: 'idle' },
      }));
      original.current = null;
      spyRef.current?.restoreDraft?.();
    },
    answerClarify: (questionId, answer) => {
      move((current) => {
        if (current.clarify === null) return current;
        const questions = current.clarify.questions.map((question) =>
          question.id === questionId ? { ...question, answer } : question,
        );
        const done = questions.every((question) => question.answer !== undefined);
        return {
          ...current,
          clarify: { ...current.clarify, questions, status: done ? 'rewriting' : 'asking' },
        };
      });
      spyRef.current?.answerClarify?.(questionId, answer);
    },
    sendAsWritten: () => {
      move((current) => ({
        ...current,
        clarify: null,
        run: startedRun(),
      }));
      spyRef.current?.sendAsWritten?.();
    },
    dismissClarify: () => {
      move((current) => ({
        ...current,
        draft: current.clarify === null ? current.draft : current.clarify.request,
        clarify: null,
      }));
      spyRef.current?.dismissClarify?.();
    },
    setComposerFocused: (focused) => {
      spyRef.current?.setComposerFocused?.(focused);
    },
  };

  return { view, actions, set };
}
