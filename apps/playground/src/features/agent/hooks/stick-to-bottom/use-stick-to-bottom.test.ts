/**
 * The thread's scroll contract (SPEC §3.12, §4.4, §5 "what never animates"):
 * - a real wheel, pointer, touch or keyboard scroll upward releases the follow;
 * - the panel's own growth never moves a reader who scrolled up;
 * - scrolling back to the bottom resumes the follow;
 * - under `prefers-reduced-motion: reduce` every scroll the hook makes is instant.
 *
 * jsdom has no layout, so each test gives the thread a fake one: a 300px viewport over
 * content whose height the test sets, a clamped `scrollTop` that fires `scroll`
 * asynchronously the way a browser does, and a hand-driven ResizeObserver. Time is fake
 * too (vitest fakes `requestAnimationFrame` and `performance`), so "one frame" is exact.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useStickToBottom,
  type StickToBottomInstance,
  type StickToBottomOptions,
} from './use-stick-to-bottom';

const VIEWPORT = 300;
/** Upstream's bottom: `scrollHeight - 1 - clientHeight`. */
const bottomOf = (contentHeight: number): number => contentHeight - 1 - VIEWPORT;
const FRAME_MS = 17;
/** Long enough for any spring and the 350ms retain window to settle. */
const SETTLE_MS = 3000;

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

/* ── A thread with a fake layout ─────────────────────────────────────────────── */

interface Thread {
  readonly hook: RenderHookResult<StickToBottomInstance, unknown>;
  readonly scroll: HTMLElement;
  readonly content: HTMLElement;
  readonly line: HTMLElement;
  /** Content height changes and the ResizeObserver reports it, as after a render. */
  grow: (height: number) => void;
  /** Composer/panel changes the viewport, including zero while hidden. */
  resizeViewport: (height: number) => void;
  /** The reader moves the thread (scrollbar, touch, keyboard): no ignore marker. */
  userScrollTo: (top: number) => void;
  /** The reader turns the wheel over `target` (default: a line in the thread). */
  wheel: (deltaY: number, target?: Element) => void;
}

function defineLayout(
  element: HTMLElement,
  layout: { clientHeight: () => number; scrollHeight: () => number },
  onScroll: () => void,
): { top: () => number; set: (top: number) => void } {
  let top = 0;
  // A browser snaps the offset to a device pixel (dpr 1 here). Upstream's spring relies
  // on it: it accumulates sub-pixel steps until one moves the thread by a whole pixel.
  const clamp = (value: number): number =>
    Math.min(
      Math.max(0, Math.round(value)),
      Math.max(0, layout.scrollHeight() - layout.clientHeight()),
    );
  Object.defineProperties(element, {
    clientHeight: { configurable: true, get: layout.clientHeight },
    scrollHeight: { configurable: true, get: layout.scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        const next = clamp(value);
        if (next === top) return;
        top = next;
        onScroll();
      },
    },
  });
  return {
    top: () => top,
    set: (value) => {
      top = clamp(value);
    },
  };
}

function mountThread(options?: StickToBottomOptions, contentHeight = 1000): Thread {
  const hook = renderHook(() => useStickToBottom(options));
  const scroll = document.createElement('div');
  // The panel's real thread clips inline overflow; upstream's wheel check read the
  // `overflow` shorthand, which is "hidden auto" here, and never released the follow.
  scroll.style.overflowX = 'hidden';
  scroll.style.overflowY = 'auto';
  const content = document.createElement('ol');
  const line = document.createElement('li');
  line.textContent = 'Hero قسم الخدمات';
  content.append(line);
  scroll.append(content);
  document.body.append(scroll);

  let height = contentHeight;
  let viewportHeight = VIEWPORT;
  // A browser fires one `scroll` per frame however many times scrollTop was written,
  // and never synchronously inside the write.
  let scrollQueued = false;
  const queueScroll = (): void => {
    if (scrollQueued) return;
    scrollQueued = true;
    queueMicrotask(() => {
      scrollQueued = false;
      scroll.dispatchEvent(new Event('scroll'));
    });
  };
  const layout = defineLayout(
    scroll,
    { clientHeight: () => viewportHeight, scrollHeight: () => Math.max(height, viewportHeight) },
    queueScroll,
  );

  act(() => {
    hook.result.current.scrollRef(scroll);
    hook.result.current.contentRef(content);
  });

  return {
    hook,
    scroll,
    content,
    line,
    grow: (next) => {
      height = next;
      act(() => {
        for (const observer of FakeResizeObserver.live) {
          if (observer.targets.has(content)) observer.fire(content, next);
        }
      });
    },
    resizeViewport: (next) => {
      viewportHeight = next;
      act(() => {
        for (const observer of FakeResizeObserver.live) {
          if (observer.targets.has(scroll)) observer.fire(scroll, next);
        }
      });
    },
    userScrollTo: (top) => {
      act(() => {
        layout.set(top);
        scroll.dispatchEvent(new Event('scroll'));
      });
    },
    wheel: (deltaY, target = line) => {
      act(() => {
        target.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true }));
      });
    },
  };
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Mount, report the first content size, and let the initial follow finish. */
async function mountAtBottom(options?: StickToBottomOptions): Promise<Thread> {
  const thread = mountThread(options);
  thread.grow(1000);
  await advance(SETTLE_MS);
  expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
  return thread;
}

function reduceMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  reduceMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeResizeObserver.live.clear();
  document.body.replaceChildren();
});

describe('useStickToBottom — following', () => {
  it('starts at the bottom and follows content that grows while the reader is there', async () => {
    const thread = await mountAtBottom();
    expect(thread.hook.result.current.isAtBottom).toBe(true);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);

    thread.grow(1400);
    await advance(SETTLE_MS);

    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1400));
    expect(thread.hook.result.current.isAtBottom).toBe(true);
  });

  it('follows a pinned reader when the composer shrinks the viewport without new content', async () => {
    const thread = await mountAtBottom();
    thread.resizeViewport(180);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(1000 - 1 - 180);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });
});

describe('useStickToBottom — the reader is in charge', () => {
  it('viewport changes never move a released reader or re-enable following', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    thread.resizeViewport(180);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(300);
    thread.resizeViewport(500);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(300);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
  });

  it('upward touch intent releases the spring before the browser can dispatch scroll', async () => {
    const thread = await mountAtBottom();
    thread.grow(3000);
    await advance(FRAME_MS * 3);
    const touch = (type: string, clientY: number): void => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, 'touches', { value: [{ clientY }] });
      act(() => {
        thread.line.dispatchEvent(event);
      });
    };
    touch('touchstart', 100);
    touch('touchmove', 140);
    const releasedAt = thread.scroll.scrollTop;
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(releasedAt);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
  });

  it.each(['ArrowUp', 'PageUp', 'Home'])(
    '%s releases a focused thread during streaming',
    async (key) => {
      const thread = await mountAtBottom();
      thread.grow(3000);
      await advance(FRAME_MS * 3);
      act(() => {
        thread.scroll.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
      const releasedAt = thread.scroll.scrollTop;
      await advance(SETTLE_MS);
      expect(thread.scroll.scrollTop).toBe(releasedAt);
      expect(thread.hook.result.current.escapedFromLock).toBe(true);
    },
  );

  it('a descendant control keeps its ArrowUp instead of releasing the thread', async () => {
    const thread = await mountAtBottom();
    const radio = document.createElement('input');
    radio.type = 'radio';
    thread.line.append(radio);
    act(() => {
      radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });

  it('wheel-up releases the follow at once, before any scroll event', async () => {
    const thread = await mountAtBottom();

    thread.wheel(-60);

    expect(thread.hook.result.current.escapedFromLock).toBe(true);
    // The wheel alone must stop the next growth from pulling the reader back.
    const readerAt = thread.scroll.scrollTop;
    thread.grow(1400);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(readerAt);
    expect(thread.hook.result.current.isAtBottom).toBe(false);
  });

  it('wheel-down does not release the follow', async () => {
    const thread = await mountAtBottom();
    thread.wheel(60);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });

  it('wheel-up over an inner scroller that can still scroll up leaves the follow alone', async () => {
    const thread = await mountAtBottom();
    const code = document.createElement('pre');
    code.style.overflowY = 'auto';
    thread.line.append(code);
    const inner = defineLayout(
      code,
      { clientHeight: () => 100, scrollHeight: () => 400 },
      () => undefined,
    );
    inner.set(50);

    thread.wheel(-60, code);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);

    // At its own top the wheel chains to the thread, so the thread is what moves.
    inner.set(0);
    thread.wheel(-60, code);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
  });

  it('content growth never scrolls a reader who scrolled up', async () => {
    const thread = await mountAtBottom();

    thread.userScrollTo(300);
    await advance(FRAME_MS);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
    expect(thread.hook.result.current.isAtBottom).toBe(false);

    // A build streams: many growths, each would once have yanked the reader down.
    for (const height of [1200, 1500, 1900, 2600]) {
      thread.grow(height);
      await advance(500);
      expect(thread.scroll.scrollTop).toBe(300);
    }
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(300);
    expect(thread.hook.result.current.isAtBottom).toBe(false);
  });

  it('a reader who scrolls up while a follow is animating is not pulled back', async () => {
    const thread = await mountAtBottom();
    thread.grow(4000);
    await advance(FRAME_MS * 4);
    const midway = thread.scroll.scrollTop;
    expect(midway).toBeLessThan(bottomOf(4000));

    thread.wheel(-60);
    thread.userScrollTo(midway - 120);
    await advance(SETTLE_MS);

    expect(thread.scroll.scrollTop).toBe(midway - 120);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
  });

  it('returns to following when the reader scrolls back to the bottom', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(200);
    await advance(FRAME_MS);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);

    // Within 70px of the bottom, moving down, counts as back.
    thread.userScrollTo(bottomOf(1000) - 40);
    await advance(FRAME_MS);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
    expect(thread.hook.result.current.isAtBottom).toBe(true);

    thread.grow(1600);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1600));
  });

  it('scrollToBottom (the jump pill) re-engages the follow', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(100);
    await advance(FRAME_MS);
    expect(thread.hook.result.current.isAtBottom).toBe(false);

    act(() => {
      void thread.hook.result.current.scrollToBottom();
    });
    await advance(SETTLE_MS);

    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
    expect(thread.hook.result.current.isAtBottom).toBe(true);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });

  it('stopScroll releases the follow without moving the thread', async () => {
    const thread = await mountAtBottom();
    const at = thread.scroll.scrollTop;
    act(() => {
      thread.hook.result.current.stopScroll();
    });
    thread.grow(1500);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(at);
  });
});

describe('useStickToBottom — reduced motion', () => {
  it('without reduced motion the follow is a spring: one frame does not reach the bottom', async () => {
    const thread = await mountAtBottom();
    thread.grow(2000);
    await advance(FRAME_MS * 2);
    expect(thread.scroll.scrollTop).toBeLessThan(bottomOf(2000));
  });

  it('under reduced motion the first follow lands in one frame', async () => {
    reduceMotion(true);
    const thread = mountThread();
    thread.grow(1000);
    await advance(FRAME_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
  });

  it('under reduced motion growth is followed in one frame', async () => {
    reduceMotion(true);
    const thread = await mountAtBottom();
    thread.grow(2000);
    await advance(FRAME_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(2000));
  });

  it('under reduced motion an explicit smooth scrollToBottom is instant too', async () => {
    reduceMotion(true);
    const thread = await mountAtBottom();
    thread.userScrollTo(0);
    await advance(FRAME_MS);

    act(() => {
      void thread.hook.result.current.scrollToBottom('smooth');
    });
    await advance(FRAME_MS);

    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1000));
  });

  it('reads the preference when it scrolls, so a change mid-session applies at once', async () => {
    const thread = await mountAtBottom();
    reduceMotion(true);
    thread.grow(2400);
    await advance(FRAME_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(2400));
  });

  it('an options spring is ignored under reduced motion', async () => {
    reduceMotion(true);
    const thread = await mountAtBottom({
      resize: { damping: 0.9, stiffness: 0.01 },
      initial: 'smooth',
    });
    thread.grow(2000);
    await advance(FRAME_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(2000));
  });
});

describe('useStickToBottom — header state and lifecycle', () => {
  it('hiding and restoring a released reader preserves position even if content streams while hidden', async () => {
    const thread = await mountAtBottom();
    thread.userScrollTo(300);
    await advance(FRAME_MS);
    thread.resizeViewport(0);
    thread.grow(0);
    await advance(SETTLE_MS);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
    thread.grow(1600);
    thread.resizeViewport(VIEWPORT);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(300);
    expect(thread.hook.result.current.escapedFromLock).toBe(true);
  });

  it('a pinned reader resumes at the newest content on reopening', async () => {
    const thread = await mountAtBottom();
    thread.resizeViewport(0);
    thread.grow(0);
    thread.grow(1800);
    thread.resizeViewport(VIEWPORT);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBeGreaterThanOrEqual(bottomOf(1800));
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });

  it('isScrolled says whether anything sits under the header', async () => {
    const thread = mountThread();
    expect(thread.hook.result.current.isScrolled).toBe(false);
    thread.grow(1000);
    await advance(SETTLE_MS);
    expect(thread.hook.result.current.isScrolled).toBe(true);
    thread.userScrollTo(0);
    await advance(FRAME_MS);
    expect(thread.hook.result.current.isScrolled).toBe(false);
  });

  it('initial: false starts released and does not scroll on the first size', async () => {
    const thread = mountThread({ initial: false });
    expect(thread.hook.result.current.isAtBottom).toBe(false);
    thread.grow(1000);
    await advance(SETTLE_MS);
    expect(thread.scroll.scrollTop).toBe(0);
  });

  it('detaching the refs disconnects the observer and the listeners', async () => {
    const thread = await mountAtBottom();
    expect(FakeResizeObserver.live.size).toBe(1);

    act(() => {
      thread.hook.result.current.scrollRef(null);
      thread.hook.result.current.contentRef(null);
    });
    expect(FakeResizeObserver.live.size).toBe(0);

    thread.wheel(-60);
    expect(thread.hook.result.current.escapedFromLock).toBe(false);
  });

  it('keeps the same ref callbacks and actions across renders', async () => {
    const thread = await mountAtBottom();
    const first = thread.hook.result.current;
    thread.userScrollTo(100);
    await advance(FRAME_MS);
    const second = thread.hook.result.current;
    expect(second).not.toBe(first);
    expect(second.scrollRef).toBe(first.scrollRef);
    expect(second.contentRef).toBe(first.contentRef);
    expect(second.scrollToBottom).toBe(first.scrollToBottom);
    expect(second.stopScroll).toBe(first.stopScroll);
  });
});

describe('useStickToBottom — provenance', () => {
  it('points its kept licence header at files this repository has', () => {
    // Vitest runs from apps/playground; the repo root is two levels up. Upstream's header
    // said "See License.txt in the project root", a file this repository never had.
    const repo = join(process.cwd(), '..', '..');
    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'features',
        'agent',
        'hooks',
        'stick-to-bottom',
        'use-stick-to-bottom.ts',
      ),
      'utf8',
    );
    const header = source.slice(0, source.indexOf('*/'));
    expect(header).toContain('Copyright (c) StackBlitz');
    const named = [...header.matchAll(/\bvendor\/[\w./-]+[\w]/g)].map((match) => match[0]);
    expect(named).toEqual(['vendor/use-stick-to-bottom/LICENSE', 'vendor/THIRD_PARTY_LICENSES.md']);
    for (const path of named) expect(existsSync(join(repo, path)), path).toBe(true);
    expect(header).not.toContain('License.txt');
  });
});
