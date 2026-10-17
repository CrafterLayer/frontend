/*!---------------------------------------------------------------------------------------------
 *  Copyright (c) StackBlitz. All rights reserved.
 *  Licensed under the MIT License. See vendor/use-stick-to-bottom/LICENSE (and
 *  vendor/THIRD_PARTY_LICENSES.md) for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Keeps the agent thread pinned to its newest line while the reader is there, and lets go
 * the moment the reader goes elsewhere (SPEC §3.12, §4.4).
 *
 * Adapted from `use-stick-to-bottom` (stackblitz-labs/use-stick-to-bottom @ 8d6a19a, v1.1.6,
 * `src/useStickToBottom.ts`, MIT). The verbatim original is
 * `vendor/use-stick-to-bottom/useStickToBottom.upstream.ts`; every change is listed in
 * `vendor/VENDOR.md`, and the ones that change behaviour are:
 *
 * - Reduced motion. Under `prefers-reduced-motion: reduce` every scroll the hook makes is
 *   instant: the first follow, each follow on growth, and an explicit `scrollToBottom`
 *   (the jump pill), whatever animation the caller asked for. The query is read when a
 *   scroll starts, so changing the OS setting mid-session applies to the next scroll.
 *   Upstream has no reduced-motion handling at all.
 * - The wheel check. Upstream releases on wheel-up only when the nearest ancestor whose
 *   computed `overflow` is exactly `auto` or `scroll` is the thread. The thread clips
 *   inline overflow, and `overflow-x: hidden; overflow-y: auto` computes to the shorthand
 *   "hidden auto", so upstream would walk past it and never release. Ours asks the real
 *   question: does an element between the pointer and the thread still have room to
 *   scroll up? If not, the wheel moves the thread, and the follow is released.
 * - `scrollToBottom()` (without `preserveScrollPosition`) clears `escapedFromLock`: the
 *   jump pill brings the reader back, and the flag now says so.
 * - `isScrolled`, new: the thread is scrolled away from its top, which is when the header
 *   draws its hairline (SPEC §2.5).
 * - Both viewport and content are observed. Composer growth, panel resizing and restoring
 *   a hidden panel follow only a pinned reader. Zero-size reports never overwrite the
 *   reading position or release state. Upward touch and keyboard intent stop the spring
 *   before the browser's scroll event, as wheel intent already does.
 *
 * The rest is upstream's logic, moved out of React: a plain controller owns the DOM
 * listeners and the spring, and React holds only the four booleans a component renders.
 * That is what lets the ref callbacks and actions keep one identity for the life of the
 * component, and it keeps every ref read out of render.
 */
import { useLayoutEffect, useMemo, useState, type RefCallback } from 'react';

/* ── Public types (upstream's, less what the panel does not use) ─────────────── */

export interface SpringAnimation {
  /** 0 to 1: how much to damp the spring. 0 is none, 1 is full. @default 0.7 */
  readonly damping?: number | undefined;
  /** How fast the spring gets up to speed. @default 0.05 */
  readonly stiffness?: number | undefined;
  /** The spring's inertial mass; higher is slower. @default 1.25 */
  readonly mass?: number | undefined;
}

export type Animation = ScrollBehavior | SpringAnimation;

export interface ScrollElements {
  readonly scrollElement: HTMLElement;
  readonly contentElement: HTMLElement;
}

/** Moves the bottom the hook aims for; the result is clamped to `[0, targetScrollTop]`. */
export type GetTargetScrollTop = (targetScrollTop: number, context: ScrollElements) => number;

export interface StickToBottomOptions extends SpringAnimation {
  /** How to follow growth while at the bottom. Forced to `instant` under reduced motion. */
  readonly resize?: Animation | undefined;
  /**
   * How to reach the bottom on the first size report; `false` starts released and does
   * not scroll. Forced to `instant` under reduced motion.
   */
  readonly initial?: Animation | boolean | undefined;
  readonly targetScrollTop?: GetTargetScrollTop | undefined;
}

export type ScrollToBottomOptions =
  | ScrollBehavior
  | {
      readonly animation?: Animation | undefined;
      /**
       * Wait for a scroll already running to finish first; a number waits that many
       * milliseconds instead. @default false
       */
      readonly wait?: boolean | number | undefined;
      /** Keep the reader from escaping this scroll with the wheel. @default false */
      readonly ignoreEscapes?: boolean | undefined;
      /** Only scroll if the reader is already at the bottom. @default false */
      readonly preserveScrollPosition?: boolean | undefined;
      /**
       * Extra milliseconds this scroll keeps following after it first reaches the bottom.
       * (Upstream also takes a Promise here; nothing in the panel passes one.) @default 0
       */
      readonly duration?: number | undefined;
    };

/** Resolves `true` when the scroll ended at the bottom, `false` when the reader left. */
export type ScrollToBottom = (scrollOptions?: ScrollToBottomOptions) => Promise<boolean> | boolean;
export type StopScroll = () => void;

export interface StickToBottomInstance {
  /** Attach to the scrolling element (the thread). Stable for the component's life. */
  readonly scrollRef: RefCallback<HTMLElement>;
  /** Attach to the element whose height grows (the thread's list). Stable. */
  readonly contentRef: RefCallback<HTMLElement>;
  /** Scroll to the bottom and resume following. Stable. */
  readonly scrollToBottom: ScrollToBottom;
  /** Release the follow without moving. Stable. */
  readonly stopScroll: StopScroll;
  /** Following, or within 70px of the bottom: the jump pill hides when this is true. */
  readonly isAtBottom: boolean;
  /** Within 70px of the bottom, following or not. */
  readonly isNearBottom: boolean;
  /** The reader scrolled up and has not come back: growth will not move them. */
  readonly escapedFromLock: boolean;
  /** The thread is scrolled away from its top: content sits under the header. */
  readonly isScrolled: boolean;
}

/* ── Constants (upstream) ────────────────────────────────────────────────────── */

interface Spring {
  damping: number;
  stiffness: number;
  mass: number;
}

type ResolvedSpring = Readonly<Spring>;

const DEFAULT_SPRING_ANIMATION: ResolvedSpring = {
  damping: 0.7,
  stiffness: 0.05,
  mass: 1.25,
};

type Behavior = 'instant' | ResolvedSpring;

const STICK_TO_BOTTOM_OFFSET_PX = 70;
const SIXTY_FPS_INTERVAL_MS = 1000 / 60;
const RETAIN_ANIMATION_DURATION_MS = 350;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/* ── Text selection (upstream, installed on first use instead of at import) ──── */

let mouseDown = false;
let mouseTracking = false;

function trackMouseButton(): void {
  if (mouseTracking || typeof document === 'undefined') return;
  mouseTracking = true;
  document.addEventListener('mousedown', () => {
    mouseDown = true;
  });
  document.addEventListener('mouseup', () => {
    mouseDown = false;
  });
  document.addEventListener('click', () => {
    mouseDown = false;
  });
}

/* ── Animations ──────────────────────────────────────────────────────────────── */

const animationCache = new Map<string, ResolvedSpring>();

/** Upstream's merge: later entries win; `'instant'` wins until an object follows it. */
function mergeAnimations(...animations: readonly (Animation | boolean | undefined)[]): Behavior {
  const result: Spring = { ...DEFAULT_SPRING_ANIMATION };
  let instant = false;

  for (const animation of animations) {
    if (animation === 'instant') {
      instant = true;
      continue;
    }
    if (typeof animation !== 'object') continue;

    instant = false;
    result.damping = animation.damping ?? result.damping;
    result.stiffness = animation.stiffness ?? result.stiffness;
    result.mass = animation.mass ?? result.mass;
  }

  if (instant) return 'instant';
  const key = JSON.stringify(result);
  let cached = animationCache.get(key);
  if (cached === undefined) {
    cached = Object.freeze(result);
    animationCache.set(key, cached);
  }
  return cached;
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

/** The reduced-motion patch: one place every scroll's behaviour is decided. */
function behaviorFor(...animations: readonly (Animation | boolean | undefined)[]): Behavior {
  return prefersReducedMotion() ? 'instant' : mergeAnimations(...animations);
}

/* ── The wheel patch ─────────────────────────────────────────────────────────── */

function canScrollUp(element: Element): boolean {
  if (element.scrollTop <= 0 || element.scrollHeight <= element.clientHeight) return false;
  const { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll';
}

/** Whether an element between the wheel's target and the thread will take the wheel. */
function innerElementTakesWheel(target: EventTarget | null, scroll: HTMLElement): boolean {
  let element = target instanceof Element ? target : null;
  while (element !== null && element !== scroll) {
    if (canScrollUp(element)) return true;
    element = element.parentElement;
  }
  return false;
}

/* ── The controller: upstream's hook body, outside React ─────────────────────── */

interface ViewState {
  readonly isAtBottom: boolean;
  readonly isNearBottom: boolean;
  readonly escapedFromLock: boolean;
  readonly isScrolled: boolean;
}

type Publish = (patch: Partial<ViewState>) => void;

interface Controller {
  readonly scrollRef: RefCallback<HTMLElement>;
  readonly contentRef: RefCallback<HTMLElement>;
  readonly scrollToBottom: ScrollToBottom;
  readonly stopScroll: StopScroll;
  configure: (options: StickToBottomOptions) => void;
}

interface RunningAnimation {
  readonly behavior: Behavior;
  readonly ignoreEscapes: boolean;
  readonly promise: Promise<boolean>;
}

function createController(initialOptions: StickToBottomOptions, publish: Publish): Controller {
  let options = initialOptions;
  let scrollElement: HTMLElement | null = null;
  let contentElement: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | undefined;
  let lastCalculation: { targetScrollTop: number; calculatedScrollTop: number } | undefined;
  let previousContentHeight: number | undefined;
  let previousViewportHeight: number | undefined;
  let hiddenScrollTop: number | undefined;
  let touchY: number | undefined;

  // Upstream's `state`: the scroll position through getters, plus the spring's memory.
  const state = {
    lastScrollTop: undefined as number | undefined,
    ignoreScrollToTop: undefined as number | undefined,
    resizeDifference: 0,
    animation: undefined as RunningAnimation | undefined,
    lastTick: undefined as number | undefined,
    velocity: 0,
    accumulated: 0,
    escapedFromLock: false,
    isAtBottom: initialOptions.initial !== false,

    get scrollTop(): number {
      return scrollElement?.scrollTop ?? 0;
    },
    set scrollTop(scrollTop: number) {
      const element = scrollElement;
      if (element === null) return;
      // Programmatic writes must land now, not through CSS smooth scrolling. Upstream
      // restores the COMPUTED value as an inline style, which leaves one behind for good;
      // this restores whatever inline value was there.
      const smooth = getComputedStyle(element).scrollBehavior === 'smooth';
      const inline = element.style.scrollBehavior;
      if (smooth) element.style.scrollBehavior = 'auto';
      element.scrollTop = scrollTop;
      state.ignoreScrollToTop = element.scrollTop;
      if (smooth) element.style.scrollBehavior = inline;
    },

    get targetScrollTop(): number {
      if (scrollElement === null || contentElement === null) return 0;
      return Math.max(0, scrollElement.scrollHeight - 1 - scrollElement.clientHeight);
    },

    get calculatedTargetScrollTop(): number {
      const scroll = scrollElement;
      const content = contentElement;
      if (scroll === null || content === null) return 0;

      const targetScrollTop = this.targetScrollTop;
      // Read live: upstream closed over the FIRST render's options here.
      const getTarget = options.targetScrollTop;
      if (getTarget === undefined) return targetScrollTop;

      if (lastCalculation?.targetScrollTop === targetScrollTop) {
        return lastCalculation.calculatedScrollTop;
      }

      const calculatedScrollTop = Math.max(
        Math.min(
          getTarget(targetScrollTop, { scrollElement: scroll, contentElement: content }),
          targetScrollTop,
        ),
        0,
      );
      lastCalculation = { targetScrollTop, calculatedScrollTop };
      requestAnimationFrame(() => {
        lastCalculation = undefined;
      });
      return calculatedScrollTop;
    },

    get scrollDifference(): number {
      return this.calculatedTargetScrollTop - this.scrollTop;
    },

    get isNearBottom(): boolean {
      return this.scrollDifference <= STICK_TO_BOTTOM_OFFSET_PX;
    },
  };

  const setIsAtBottom = (isAtBottom: boolean): void => {
    state.isAtBottom = isAtBottom;
    publish({ isAtBottom });
  };

  const setEscapedFromLock = (escapedFromLock: boolean): void => {
    state.escapedFromLock = escapedFromLock;
    publish({ escapedFromLock });
  };

  const isSelecting = (): boolean => {
    if (!mouseDown) return false;
    const selection = window.getSelection();
    if (selection === null || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const scroll = scrollElement;
    if (scroll === null) return false;
    return (
      range.commonAncestorContainer.contains(scroll) ||
      scroll.contains(range.commonAncestorContainer)
    );
  };

  const scrollToBottom: ScrollToBottom = (scrollOptions = {}) => {
    const request =
      typeof scrollOptions === 'string' ? { animation: scrollOptions } : scrollOptions;

    if (request.preserveScrollPosition !== true) {
      // An explicit jump is the reader coming back. Upstream left `escapedFromLock` true
      // here, because the scroll events of its own animation are ignored, so the flag
      // kept saying "scrolled away" while the thread sat at the bottom following.
      setEscapedFromLock(false);
      setIsAtBottom(true);
    }

    const waitElapsed = Date.now() + (Number(request.wait) || 0);
    const behavior = behaviorFor(options, request.animation);
    const ignoreEscapes = request.ignoreEscapes ?? false;
    const durationElapsed = waitElapsed + (request.duration ?? 0);
    let startTarget = state.calculatedTargetScrollTop;

    const next = (): Promise<boolean> => {
      const promise: Promise<boolean> = new Promise<number>((resolve) => {
        requestAnimationFrame(resolve);
      }).then((): Promise<boolean> | boolean => {
        if (!state.isAtBottom || scrollElement === null || scrollElement.clientHeight === 0) {
          state.animation = undefined;
          return false;
        }

        const { scrollTop } = state;
        const tick = performance.now();
        const tickDelta = (tick - (state.lastTick ?? tick)) / SIXTY_FPS_INTERVAL_MS;
        state.animation ??= { behavior, promise, ignoreEscapes };

        if (state.animation.behavior === behavior) state.lastTick = tick;

        if (isSelecting()) return next();
        if (waitElapsed > Date.now()) return next();

        if (scrollTop < Math.min(startTarget, state.calculatedTargetScrollTop)) {
          if (state.animation.behavior === behavior) {
            if (behavior === 'instant') {
              state.scrollTop = state.calculatedTargetScrollTop;
              return next();
            }

            state.velocity =
              (behavior.damping * state.velocity + behavior.stiffness * state.scrollDifference) /
              behavior.mass;
            state.accumulated += state.velocity * tickDelta;
            state.scrollTop += state.accumulated;

            if (state.scrollTop !== scrollTop) state.accumulated = 0;
          }
          return next();
        }

        if (durationElapsed > Date.now()) {
          startTarget = state.calculatedTargetScrollTop;
          return next();
        }

        state.animation = undefined;

        // Still short of the bottom (it grew meanwhile): follow again with the resize
        // animation, for whatever is left of the duration.
        if (state.scrollTop < state.calculatedTargetScrollTop) {
          const remaining = Math.max(0, durationElapsed - Date.now());
          return scrollToBottom({
            animation: behaviorFor(options, options.resize),
            ignoreEscapes,
            duration: remaining === 0 ? undefined : remaining,
          });
        }

        return state.isAtBottom;
      });

      return promise.then((isAtBottom) => {
        requestAnimationFrame(() => {
          if (state.animation === undefined) {
            state.lastTick = undefined;
            state.velocity = 0;
          }
        });
        return isAtBottom;
      });
    };

    if (request.wait !== true) state.animation = undefined;
    if (state.animation?.behavior === behavior) return state.animation.promise;
    return next();
  };

  const stopScroll: StopScroll = () => {
    setEscapedFromLock(true);
    setIsAtBottom(false);
  };

  const handleScroll = (event: Event): void => {
    if (
      event.target !== scrollElement ||
      scrollElement === null ||
      scrollElement.clientHeight === 0
    )
      return;

    const { scrollTop, ignoreScrollToTop } = state;
    let lastScrollTop = state.lastScrollTop ?? scrollTop;

    state.lastScrollTop = scrollTop;
    state.ignoreScrollToTop = undefined;

    // A reader scrolling up during an animation may not get a scroll event of their own;
    // measure "up" from the position the animation last wrote.
    if (ignoreScrollToTop !== undefined && ignoreScrollToTop > scrollTop) {
      lastScrollTop = ignoreScrollToTop;
    }

    publish({ isNearBottom: state.isNearBottom, isScrolled: scrollTop > 0 });

    // A scroll event can arrive before the ResizeObserver's, so decide a tick later.
    // https://github.com/WICG/resize-observer/issues/25#issuecomment-248757228
    setTimeout(() => {
      if (scrollElement === null || scrollElement.clientHeight === 0) return;
      if (state.resizeDifference !== 0 || scrollTop === ignoreScrollToTop) return;

      if (isSelecting()) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
        return;
      }

      const isScrollingDown = scrollTop > lastScrollTop;
      const isScrollingUp = scrollTop < lastScrollTop;

      if (state.animation?.ignoreEscapes === true) {
        state.scrollTop = lastScrollTop;
        return;
      }

      if (isScrollingUp) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
      }
      if (isScrollingDown) setEscapedFromLock(false);
      if (!state.escapedFromLock && state.isNearBottom) setIsAtBottom(true);
    }, 1);
  };

  const handleWheel = (event: WheelEvent): void => {
    const scroll = scrollElement;
    if (scroll === null) return;
    // The browser can cancel a wheel scroll that an animation frame overwrites, so a
    // wheel turned upward releases at once instead of waiting for its scroll event.
    if (
      event.deltaY < 0 &&
      scroll.scrollHeight > scroll.clientHeight &&
      state.animation?.ignoreEscapes !== true &&
      !innerElementTakesWheel(event.target, scroll)
    ) {
      setEscapedFromLock(true);
      setIsAtBottom(false);
    }
  };

  const handleTouchStart = (event: TouchEvent): void => {
    touchY = event.touches[0]?.clientY;
  };

  const handleTouchMove = (event: TouchEvent): void => {
    const currentY = event.touches[0]?.clientY;
    const scroll = scrollElement;
    if (
      scroll !== null &&
      currentY !== undefined &&
      touchY !== undefined &&
      currentY > touchY &&
      scroll.scrollHeight > scroll.clientHeight &&
      state.animation?.ignoreEscapes !== true &&
      !innerElementTakesWheel(event.target, scroll)
    ) {
      stopScroll();
    }
    touchY = currentY;
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    const scroll = scrollElement;
    // Descendant inputs/radios own their arrows; only a focused conversation scrolls.
    if (scroll === null || event.target !== scroll || event.defaultPrevented) return;
    if (
      (event.key === 'ArrowUp' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        (event.key === ' ' && event.shiftKey)) &&
      scroll.scrollHeight > scroll.clientHeight &&
      state.animation?.ignoreEscapes !== true
    ) {
      stopScroll();
    }
  };

  const observeLayout = (): void => {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    const scroll = scrollElement;
    const content = contentElement;
    if (scroll === null || content === null) return;

    resizeObserver = new ResizeObserver(() => {
      if (scroll.clientHeight === 0) {
        hiddenScrollTop ??= state.lastScrollTop ?? state.scrollTop;
        state.animation = undefined;
        return;
      }

      const height = scroll.scrollHeight;
      const viewportHeight = scroll.clientHeight;
      const firstReport = previousContentHeight === undefined;
      const difference =
        height -
        (previousContentHeight ?? height) +
        (previousViewportHeight ?? viewportHeight) -
        viewportHeight;
      state.resizeDifference = difference;

      if (hiddenScrollTop !== undefined) {
        if (!state.isAtBottom) state.scrollTop = hiddenScrollTop;
        hiddenScrollTop = undefined;
      }
      // A real visible shrink may clamp the offset; a hidden zero-size report must not.
      if (state.scrollTop > state.targetScrollTop) state.scrollTop = state.targetScrollTop;
      publish({ isNearBottom: state.isNearBottom, isScrolled: state.scrollTop > 0 });

      if (state.isAtBottom) {
        const animation = behaviorFor(options, firstReport ? options.initial : options.resize);
        void scrollToBottom({
          animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === 'instant' ? undefined : RETAIN_ANIMATION_DURATION_MS,
        });
      }

      previousContentHeight = height;
      previousViewportHeight = viewportHeight;
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (state.resizeDifference === difference) state.resizeDifference = 0;
        }, 1);
      });
    });

    resizeObserver.observe(content);
    resizeObserver.observe(scroll);
  };

  const scrollRef: RefCallback<HTMLElement> = (scroll) => {
    scrollElement?.removeEventListener('scroll', handleScroll);
    scrollElement?.removeEventListener('wheel', handleWheel);
    scrollElement?.removeEventListener('touchstart', handleTouchStart);
    scrollElement?.removeEventListener('touchmove', handleTouchMove);
    scrollElement?.removeEventListener('keydown', handleKeyDown);
    scrollElement = scroll;
    observeLayout();
    if (scroll === null) return;
    trackMouseButton();
    scroll.addEventListener('scroll', handleScroll, { passive: true });
    scroll.addEventListener('wheel', handleWheel, { passive: true });
    scroll.addEventListener('touchstart', handleTouchStart, { passive: true });
    scroll.addEventListener('touchmove', handleTouchMove, { passive: true });
    scroll.addEventListener('keydown', handleKeyDown);
  };

  const contentRef: RefCallback<HTMLElement> = (content) => {
    contentElement = content;
    observeLayout();
  };

  return {
    scrollRef,
    contentRef,
    scrollToBottom,
    stopScroll,
    configure: (next) => {
      options = next;
    },
  };
}

function changes(previous: ViewState, patch: Partial<ViewState>): boolean {
  return (Object.keys(patch) as (keyof ViewState)[]).some((key) => patch[key] !== previous[key]);
}

/**
 * Attach `scrollRef` to the thread and `contentRef` to the list inside it. The thread
 * follows new content while the reader is at the bottom, and never moves once the reader
 * has scrolled up, until they come back or call `scrollToBottom`.
 */
export function useStickToBottom(options: StickToBottomOptions = {}): StickToBottomInstance {
  const [view, setView] = useState<ViewState>(() => ({
    isAtBottom: options.initial !== false,
    isNearBottom: false,
    escapedFromLock: false,
    isScrolled: false,
  }));

  // Lazy state, never replaced: one controller per component, so the refs and actions
  // keep their identity and nothing reads a ref during render.
  const [controller] = useState(() =>
    createController(options, (patch) => {
      setView((previous) => (changes(previous, patch) ? { ...previous, ...patch } : previous));
    }),
  );

  useLayoutEffect(() => {
    controller.configure(options);
  });

  return useMemo(
    () => ({
      scrollRef: controller.scrollRef,
      contentRef: controller.contentRef,
      scrollToBottom: controller.scrollToBottom,
      stopScroll: controller.stopScroll,
      isAtBottom: view.isAtBottom || view.isNearBottom,
      isNearBottom: view.isNearBottom,
      escapedFromLock: view.escapedFromLock,
      isScrolled: view.isScrolled,
    }),
    [controller, view],
  );
}
