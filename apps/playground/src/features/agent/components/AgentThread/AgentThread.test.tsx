/**
 * AgentThread (SPEC §4.4, §3.12, §6.1, §6.3): the conversation and its scroll.
 *
 * What this file holds it to:
 * - it is a region named "Conversation" with an ordered list of turns, and NOT a log:
 *   the panel's one live region is LiveStatus, whatever state the frame is in;
 * - with no turns, the greeting and its starters; suggestions hide while a run is live,
 *   while the composer has text and while a decision waits, and a chosen one fills the
 *   composer and never sends;
 * - stick-to-bottom follows the newest line while the reader is there and never yanks a
 *   reader who scrolled up, however much the build grows;
 * - the jump pill shows only while the reader is away, says why ("Latest", "Building",
 *   "Editing"), hides while focus is in the newest turn and whenever the focused element
 *   reaches into the band it floats over, and lands focus on the newest record's head.
 *
 * jsdom has no layout, so the scroll tests give the thread a fake one (the hook's own test
 * harness): a 300px viewport over content whose height the test sets, a clamped
 * `scrollTop` that fires `scroll` the way a browser does, and a hand-driven
 * ResizeObserver. Time is fake, so a spring settles exactly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { SuggestionView, TurnView } from '../../model/view-types';
import {
  frameConversation,
  frameEmptyViews,
  framePlanWaiting,
  frameSuggestions,
} from '../../testing/wp-11-frame-fixtures';
import { AgentHeader } from '../AgentHeader';
import { LiveStatus } from '../LiveStatus';

import { AgentThread, type AgentThreadHandle, type AgentThreadProps } from './AgentThread';

const LIVE = '[aria-live], [role=status], [role=log], [role=alert]';
const VIEWPORT = 300;
/** The hook's bottom: `scrollHeight - 1 - clientHeight`. */
const bottomOf = (contentHeight: number): number => contentHeight - 1 - VIEWPORT;
const FRAME_MS = 17;
/** Long enough for any spring and the hook's 350ms retain window to settle. */
const SETTLE_MS = 3000;

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'AgentThread', 'AgentThread.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

/* ── A ResizeObserver the test drives ────────────────────────────────────────── */

class FakeResizeObserver {
  static readonly live = new Set<FakeResizeObserver>();
  readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.live.add(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    FakeResizeObserver.live.delete(this);
  }

  fire(target: Element, height: number): void {
    const entry = { target, contentRect: { height } } as unknown as ResizeObserverEntry;
    this.callback([entry], this);
  }
}

/* ── Turns, drawn the simplest way a record can be ───────────────────────────── */

/** A record with a focusable head and one action; a person's turn as plain text. */
function TestTurn({ turn }: { readonly turn: TurnView }) {
  const headId = useId();
  if (turn.kind === 'user') return <p>{turn.view.text}</p>;
  return (
    <article aria-labelledby={headId}>
      <h3 id={headId} tabIndex={-1}>
        {`Record ${turn.view.turnId}`}
      </h3>
      <button type="button">{`Undo ${turn.view.turnId}`}</button>
    </article>
  );
}

function baseProps(overrides: Partial<AgentThreadProps> = {}): AgentThreadProps {
  return {
    locale: 'en',
    turns: frameConversation('en', 'build'),
    renderTurn: (turn) => <TestTurn turn={turn} />,
    activity: 'build',
    empty: frameEmptyViews('en').greeting,
    suggestions: [],
    draft: '',
    onSuggestion: vi.fn(),
    ...overrides,
  };
}

/* ── A thread with a fake layout ─────────────────────────────────────────────── */

interface Mounted {
  readonly scroller: HTMLElement;
  readonly content: HTMLElement;
  /** Re-render with these props on top of the current ones. */
  update: (overrides: Partial<AgentThreadProps>) => void;
  /** Content height changes and the ResizeObserver reports it, as after a render. */
  grow: (height: number) => void;
  /** The reader moves the thread (scrollbar, touch, keyboard). */
  userScrollTo: (top: number) => void;
}

function mount(overrides: Partial<AgentThreadProps> = {}): Mounted {
  let props = baseProps(overrides);
  const view = render(<AgentThread {...props} />);
  const scroller = screen.getByRole('region', { name: 'Conversation' });
  const content = view.container.querySelector<HTMLElement>('.ck-agent-thread__content');
  if (content === null) throw new Error('no content');

  let height = 0;
  let top = 0;
  let scrollQueued = false;
  // A browser fires one `scroll` per frame however many writes, never inside the write.
  const queueScroll = (): void => {
    if (scrollQueued) return;
    scrollQueued = true;
    queueMicrotask(() => {
      scrollQueued = false;
      scroller.dispatchEvent(new Event('scroll'));
    });
  };
  const clamp = (value: number): number =>
    Math.min(Math.max(0, Math.round(value)), Math.max(0, Math.max(height, VIEWPORT) - VIEWPORT));
  Object.defineProperties(scroller, {
    clientHeight: { configurable: true, get: () => VIEWPORT },
    scrollHeight: { configurable: true, get: () => Math.max(height, VIEWPORT) },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        const next = clamp(value);
        if (next === top) return;
        top = next;
        queueScroll();
      },
    },
  });

  return {
    scroller,
    content,
    update: (next) => {
      props = { ...props, ...next };
      view.rerender(<AgentThread {...props} />);
    },
    grow: (next) => {
      height = next;
      act(() => {
        for (const observer of FakeResizeObserver.live) {
          if (observer.targets.has(content)) observer.fire(content, next);
        }
      });
    },
    userScrollTo: (next) => {
      act(() => {
        top = clamp(next);
        scroller.dispatchEvent(new Event('scroll'));
      });
    },
  };
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Mount a long conversation and let the first follow land at the bottom. */
async function mountAtBottom(overrides: Partial<AgentThreadProps> = {}): Promise<Mounted> {
  const thread = mount(overrides);
  thread.grow(1000);
  await advance(SETTLE_MS);
  expect(thread.scroller.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
  return thread;
}

function pill(name: string): HTMLElement | null {
  return screen.queryByRole('button', { name });
}

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 320,
    width: 320,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeResizeObserver.live.clear();
});

/* ── Structure ───────────────────────────────────────────────────────────────── */

describe('AgentThread: structure', () => {
  it('is a region named "Conversation" holding an ordered list of the turns, in order', () => {
    const turns = frameConversation('en', 'build');
    render(<AgentThread {...baseProps({ turns })} />);
    const thread = screen.getByRole('region', { name: 'Conversation' });
    expect(thread.tagName).toBe('SECTION');
    const list = within(thread).getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.dataset['turnId'])).toEqual(
      turns.map((turn) => turn.view.turnId),
    );
    expect(items.map((item) => item.dataset['turnKind'])).toEqual(turns.map((turn) => turn.kind));
  });

  it('is not a log and not live: nothing in the thread announces itself', () => {
    const { container } = render(<AgentThread {...baseProps()} />);
    const thread = screen.getByRole('region', { name: 'Conversation' });
    expect(thread).not.toHaveAttribute('role');
    expect(thread).not.toHaveAttribute('aria-live');
    expect(container.querySelectorAll(LIVE)).toHaveLength(0);
  });

  it('names itself in the UI language', () => {
    render(<AgentThread {...baseProps({ locale: 'ar', turns: frameConversation('ar') })} />);
    expect(screen.getByRole('region', { name: 'المحادثة' })).toBeVisible();
  });

  it('keeps a turn’s <li> when the turn changes kind, so its focus target survives', () => {
    const plan = framePlanWaiting('en');
    const { rerender } = render(<AgentThread {...baseProps({ turns: plan, activity: null })} />);
    const before = screen.getAllByRole('listitem')[1];
    const [user, planTurn] = plan;
    if (user === undefined || planTurn?.kind !== 'page-plan') throw new Error('fixture');
    const built = frameConversation('en').find((turn) => turn.kind === 'build');
    if (built?.kind !== 'build') throw new Error('fixture');
    rerender(
      <AgentThread
        {...baseProps({
          turns: [user, { kind: 'build', view: { ...built.view, turnId: planTurn.view.turnId } }],
          activity: null,
        })}
      />,
    );
    expect(screen.getAllByRole('listitem')[1]).toBe(before);
  });

  it('is focusable, so it scrolls from the keyboard even with nothing else to focus', () => {
    render(<AgentThread {...baseProps()} />);
    expect(screen.getByRole('region', { name: 'Conversation' })).toHaveAttribute('tabindex', '0');
  });

  it('keeps exactly one live region in the panel frame, in every state', () => {
    const states: readonly Partial<AgentThreadProps>[] = [
      { turns: [], activity: null, suggestions: frameSuggestions('en').starters },
      {
        turns: frameConversation('en'),
        activity: null,
        suggestions: frameSuggestions('en').afterRun,
      },
      { turns: frameConversation('en', 'build'), activity: 'build' },
      { turns: frameConversation('en', 'edit'), activity: 'edit' },
      { turns: framePlanWaiting('en'), activity: null },
    ];
    for (const state of states) {
      const { container, unmount } = render(
        <section aria-label="Abu Ghadab">
          <AgentHeader
            locale="en"
            face={{ mood: state.activity === null ? 'idle' : 'working' }}
            scrolled
            running={state.activity !== null}
            conversationsOpen={false}
            onConversations={vi.fn()}
            onNewConversation={vi.fn()}
          />
          <AgentThread {...baseProps(state)} />
          <LiveStatus
            locale="en"
            announcement={{ key: 'build.progress', params: { done: 1, total: 8 }, seq: 1 }}
          />
        </section>,
      );
      const live = container.querySelectorAll(LIVE);
      expect(live).toHaveLength(1);
      expect(live[0]).toHaveClass('ck-agent-live');
      unmount();
    }
  });
});

/* ── The empty thread and the suggestions ────────────────────────────────────── */

describe('AgentThread: empty state and suggestions', () => {
  it('with no turns, shows the greeting and its starters, and no list of turns', () => {
    const starters = frameSuggestions('en').starters;
    const { container } = render(
      <AgentThread {...baseProps({ turns: [], activity: null, suggestions: starters })} />,
    );
    expect(container.querySelector('.ck-agent-thread__turns')).toBeNull();
    expect(container.querySelector('.ck-agent-empty__greeting')).toHaveTextContent(
      t('en', 'empty.greeting'),
    );
    const rows = within(screen.getByRole('list', { name: 'Suggestions' })).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual(starters.map((row) => row.text));
  });

  it('greets a selection by the selected block’s title', () => {
    const { container } = render(
      <AgentThread
        {...baseProps({ turns: [], activity: null, empty: frameEmptyViews('en').selection })}
      />,
    );
    expect(container.querySelector('.ck-agent-empty__greeting')).toHaveTextContent(
      'Hero is selected. What should change?',
    );
  });

  it('shows suggestions after the newest settled record', () => {
    const afterRun = frameSuggestions('en').afterRun;
    const { container } = render(
      <AgentThread
        {...baseProps({ turns: frameConversation('en'), activity: null, suggestions: afterRun })}
      />,
    );
    const list = container.querySelector('.ck-agent-thread__turns');
    const suggestions = container.querySelector('.ck-agent-suggestions');
    expect(list?.nextElementSibling).toBe(suggestions);
  });

  it('hides suggestions while a run is live, while the composer has text, and while a decision waits', () => {
    const afterRun = frameSuggestions('en').afterRun;
    const settled = frameConversation('en');
    const { rerender } = render(
      <AgentThread {...baseProps({ turns: settled, activity: null, suggestions: afterRun })} />,
    );
    const shown = () => screen.queryByRole('list', { name: 'Suggestions' }) !== null;
    expect(shown()).toBe(true);

    rerender(
      <AgentThread {...baseProps({ turns: settled, activity: 'build', suggestions: afterRun })} />,
    );
    expect(shown()).toBe(false);

    rerender(
      <AgentThread
        {...baseProps({
          turns: settled,
          activity: null,
          suggestions: afterRun,
          draft: 'Add a map',
        })}
      />,
    );
    expect(shown()).toBe(false);

    // Whitespace is not text: the composer is still empty.
    rerender(
      <AgentThread
        {...baseProps({ turns: settled, activity: null, suggestions: afterRun, draft: '  ' })}
      />,
    );
    expect(shown()).toBe(true);

    rerender(
      <AgentThread
        {...baseProps({ turns: framePlanWaiting('en'), activity: null, suggestions: afterRun })}
      />,
    );
    expect(shown()).toBe(false);
  });

  it('fills the composer from a starter, focuses it with the caret at the end, and never sends', async () => {
    const user = userEvent.setup();
    const controller = { setDraft: vi.fn(), send: vi.fn() };
    render(<FillHarness controller={controller} />);
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your request' });
    const [first] = frameSuggestions('en').starters;
    if (first === undefined) throw new Error('no starter');

    await user.click(screen.getByRole('button', { name: first.text }));

    expect(controller.setDraft).toHaveBeenCalledWith(first.text);
    expect(field).toHaveValue(first.text);
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(first.text.length);
    expect(field.selectionEnd).toBe(first.text.length);
    expect(controller.send).not.toHaveBeenCalled();
    // The composer has text now: the rows step aside until it is empty again.
    expect(screen.queryByRole('list', { name: 'Suggestions' })).toBeNull();
  });
});

interface FillHarnessProps {
  readonly controller: { readonly setDraft: (text: string) => void; readonly send: () => void };
}

/** AgentPanel's wiring, reduced: the thread above a composer inside a form that sends. */
function FillHarness({ controller }: FillHarnessProps) {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const choose = (suggestion: SuggestionView) => {
    flushSync(() => {
      setDraft(suggestion.text);
    });
    controller.setDraft(suggestion.text);
    const element = field.current;
    if (element === null) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        controller.send();
      }}
    >
      <AgentThread
        {...baseProps({
          turns: [],
          activity: null,
          suggestions: frameSuggestions('en').starters,
          draft,
          onSuggestion: choose,
        })}
      />
      <textarea
        ref={field}
        aria-label="Your request"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </form>
  );
}

/* ── Scroll: stick to bottom, and the jump pill ──────────────────────────────── */

describe('AgentThread: stick to bottom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('lands at the bottom when it opens, and follows growth while the reader is there', async () => {
    const thread = await mountAtBottom();
    thread.grow(1400);
    await advance(SETTLE_MS);
    expect(thread.scroller.scrollTop).toBeGreaterThanOrEqual(bottomOf(1400));
    expect(pill('Building: jump to the latest')).toBeNull();
  });

  it('never yanks a reader who scrolled up, however much the build grows', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(200);
    await advance(FRAME_MS);

    // A build streams in: new rows, a new record, growth after growth.
    for (const height of [1200, 1600, 2100, 2800]) {
      thread.update({ turns: frameConversation('en', 'build') });
      thread.grow(height);
      await advance(500);
      expect(thread.scroller.scrollTop).toBe(200);
    }
    await advance(SETTLE_MS);
    expect(thread.scroller.scrollTop).toBe(200);
  });

  it('lets go when the wheel turns upward, before any scroll event', async () => {
    const thread = await mountAtBottom();
    const line = within(thread.scroller).getByText('Record e3');
    act(() => {
      line.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, bubbles: true }));
    });
    const at = thread.scroller.scrollTop;
    thread.grow(1600);
    await advance(SETTLE_MS);
    expect(thread.scroller.scrollTop).toBe(at);
    expect(pill('Building: jump to the latest')).not.toBeNull();
  });

  it('tells the header when content sits under it', async () => {
    const onScrolledChange = vi.fn();
    const thread = await mountAtBottom({ onScrolledChange });
    expect(onScrolledChange).toHaveBeenLastCalledWith(true);
    thread.userScrollTo(0);
    await advance(FRAME_MS);
    expect(onScrolledChange).toHaveBeenLastCalledWith(false);
  });

  it('scrolls back down on the panel’s request (the person sent while scrolled up)', async () => {
    const ref = createRef<AgentThreadHandle>();
    const thread = await mountAtBottom({ ref });
    thread.userScrollTo(100);
    await advance(FRAME_MS);
    act(() => {
      ref.current?.scrollToBottom();
    });
    await advance(SETTLE_MS);
    expect(thread.scroller.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
  });
});

describe('AgentThread: the jump pill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('is hidden at the bottom and appears when the reader scrolls up, saying why', async () => {
    const thread = await mountAtBottom();
    expect(pill('Building: jump to the latest')).toBeNull();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).toHaveTextContent('Building');

    thread.update({ turns: frameConversation('en', 'edit'), activity: 'edit' });
    expect(pill('Editing: jump to the latest')).toHaveTextContent('Editing');

    thread.update({ turns: frameConversation('en'), activity: null });
    expect(pill('Jump to the latest')).toHaveTextContent('Latest');
  });

  it('hides again the moment the reader is back at the bottom', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).not.toBeNull();
    thread.userScrollTo(bottomOf(1000));
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).toBeNull();
  });

  it('adds no live region of its own while it shows: LiveStatus stays the only one', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).not.toBeNull();
    expect(document.querySelectorAll(LIVE)).toHaveLength(0);
  });

  it('hides while focus is in the newest turn, and returns when focus leaves it', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).not.toBeNull();

    const newest = within(thread.scroller).getByRole('heading', { name: 'Record b4' });
    act(() => {
      newest.focus();
    });
    expect(newest).toHaveFocus();
    expect(pill('Building: jump to the latest')).toBeNull();

    const older = within(thread.scroller).getByRole('button', { name: 'Undo e3' });
    act(() => {
      older.focus();
    });
    expect(older).toHaveFocus();
    expect(pill('Building: jump to the latest')).not.toBeNull();
  });

  it('never covers the focused element, whichever turn it is in (WCAG 2.4.11)', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    vi.spyOn(thread.scroller, 'getBoundingClientRect').mockReturnValue(rect(0, VIEWPORT));

    // An older turn's button sits at the bottom of the view, where the pill floats.
    const older = within(thread.scroller).getByRole('button', { name: 'Undo e2' });
    const box = vi.spyOn(older, 'getBoundingClientRect').mockReturnValue(rect(262, 294));
    act(() => {
      older.focus();
    });
    expect(older).toHaveFocus();
    expect(pill('Building: jump to the latest')).toBeNull();

    // The reader scrolls it up out of the band: the pill comes back.
    box.mockReturnValue(rect(120, 152));
    thread.userScrollTo(260);
    await advance(FRAME_MS);
    expect(older).toHaveFocus();
    expect(pill('Building: jump to the latest')).not.toBeNull();
  });

  it('jumps to the latest: back to the bottom, focus on the newest record’s head', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    const button = pill('Building: jump to the latest');
    if (button === null) throw new Error('no pill');

    fireEvent.click(button);
    await advance(SETTLE_MS);

    expect(thread.scroller.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
    expect(within(thread.scroller).getByRole('heading', { name: 'Record b4' })).toHaveFocus();
    expect(pill('Building: jump to the latest')).toBeNull();
  });

  it('if it hides while it has focus, focus goes to the newest record’s head, never to body', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    const button = pill('Building: jump to the latest');
    if (button === null) throw new Error('no pill');
    act(() => {
      button.focus();
    });
    expect(button).toHaveFocus();

    // The reader wheels back to the bottom instead of pressing it: the pill goes.
    thread.userScrollTo(bottomOf(1000));
    await advance(FRAME_MS);
    expect(pill('Building: jump to the latest')).toBeNull();
    expect(within(thread.scroller).getByRole('heading', { name: 'Record b4' })).toHaveFocus();
  });

  it('skips a person’s own last turn: the newest RECORD’s head takes focus', async () => {
    const turns = frameConversation('en');
    const withRequest: readonly TurnView[] = [
      ...turns,
      { kind: 'user', view: { turnId: 'u9', text: 'Add a map', chips: [], notRun: false } },
    ];
    const ref = createRef<AgentThreadHandle>();
    const thread = await mountAtBottom({ turns: withRequest, activity: null, ref });
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    act(() => {
      ref.current?.jumpToLatest();
    });
    expect(within(thread.scroller).getByRole('heading', { name: 'Record e3' })).toHaveFocus();
  });

  it('with no record at all, focus lands on the thread itself, never on body', async () => {
    const ref = createRef<AgentThreadHandle>();
    const thread = await mountAtBottom({
      turns: [{ kind: 'user', view: { turnId: 'u1', text: 'Hi', chips: [], notRun: false } }],
      activity: 'routing',
      ref,
    });
    act(() => {
      ref.current?.jumpToLatest();
    });
    expect(thread.scroller).toHaveFocus();
  });
});

/* ── The stylesheet ──────────────────────────────────────────────────────────── */

describe('AgentThread.css', () => {
  it('pads 12 on the block axis and 16 on the inline axis, 12 under a 320px panel', () => {
    expect(CSS).toMatch(/padding-block:\s*var\(--bldr-space-xl\)/u);
    expect(CSS).toMatch(/padding-inline:\s*var\(--bldr-space-3xl\)/u);
    expect(CSS).toMatch(
      /@container agent \(inline-size < 320px\)\s*\{\s*\.ck-agent-thread__content\s*\{\s*padding-inline:\s*var\(--bldr-space-xl\)/u,
    );
  });

  it('spaces turns 16px apart and anchors the empty state to the bottom', () => {
    expect(CSS).toMatch(/\.ck-agent-thread__turns\s*\{[^}]*gap:\s*var\(--bldr-space-3xl\)/u);
    expect(CSS).toMatch(/\.ck-agent-thread__empty\s*\{[^}]*margin-block-start:\s*auto/u);
    expect(CSS).toMatch(/\.ck-agent-thread__content\s*\{[^}]*min-block-size:\s*100%/u);
  });

  it('floats the pill 12px above the dock, outside the scroller, letting the pointer through', () => {
    expect(CSS).toMatch(
      /\.ck-agent-thread__jump\s*\{[^}]*position:\s*absolute;[^}]*inset-block-end:\s*var\(--bldr-space-xl\);[^}]*pointer-events:\s*none/u,
    );
    expect(CSS).toMatch(/scroll-padding-block-end:/u);
  });

  it('is the only scroller and keeps its ring inside its edge', () => {
    expect(CSS).toMatch(/overflow-y:\s*auto/u);
    expect(CSS).toMatch(/overscroll-behavior:\s*contain/u);
    expect(CSS).toMatch(
      /:focus-visible[^{]*\{[^}]*outline-offset:\s*calc\(-1 \* var\(--bldr-focus-ring-width\)\)/u,
    );
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
