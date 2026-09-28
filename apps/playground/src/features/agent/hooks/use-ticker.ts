/**
 * One shared clock for every RunClock in the panel (SPEC §7.4 `hooks/use-ticker.ts`,
 * §4.1, §4.17).
 *
 * The v1 panel gave each live clock its own `setInterval`, so a thread with a RunBar, a
 * stage-timings table and a status pill ran three timers that stepped at three different
 * phases: the pill could read 0:12 while the bar still read 0:11. Here there is one
 * timer, and it fires on the wall clock's whole second, so:
 * - every clock steps at the same instant;
 * - the published time only ever moves by exactly one second, so `m:ss` never repeats
 *   or skips a second (a timer fired 4ms late still publishes the whole second);
 * - nothing runs while the document is hidden (a background tab spends no work on a
 *   clock nobody can see), and the first frame after it is shown reads the real time;
 * - nothing runs for the clocks of a hidden panel either (SPEC §4.1: hidden keeps the
 *   panel mounted and "pauses every loop and the ticker"), through `TickerPausedContext`;
 * - nothing runs when no clock is mounted, and a finished run's frozen time
 *   (`useTicker(false)`) never starts it.
 *
 * The value is epoch milliseconds, floored to the second. A clock computes its elapsed
 * time against it; a clock that started mid-second may read up to a second short, which
 * is the same bound the `m:ss` display itself has.
 */
import { createContext, use, useSyncExternalStore } from 'react';

/** One step of the shared clock. */
export const TICK_MS = 1_000;

/**
 * True below a panel that is mounted but not shown. AgentPanel provides `!visible`
 * (`<TickerPausedContext value={!visible}>`): every clock under it stops listening, and
 * the shared timer stops with the last listener, while a clock outside it (another
 * panel's) keeps the timer running. Shown again, a clock reads the real time at once.
 */
export const TickerPausedContext = createContext(false);

interface Ticker {
  /** The last published time: epoch ms, on a whole second. */
  now: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  readonly listeners: Set<() => void>;
}

const ticker: Ticker = { now: 0, timer: undefined, listeners: new Set() };

const wholeSecond = (ms: number): number => Math.floor(ms / TICK_MS) * TICK_MS;

function documentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function publish(now: number): void {
  if (now === ticker.now) return;
  ticker.now = now;
  for (const listener of ticker.listeners) listener();
}

function schedule(): void {
  // To the next whole second, whatever the phase this call happens at.
  const wait = TICK_MS - (Date.now() % TICK_MS);
  ticker.timer = setTimeout(() => {
    publish(wholeSecond(Date.now()));
    schedule();
  }, wait);
}

function start(): void {
  if (ticker.timer !== undefined || documentHidden()) return;
  publish(wholeSecond(Date.now()));
  schedule();
}

function stop(): void {
  if (ticker.timer === undefined) return;
  clearTimeout(ticker.timer);
  ticker.timer = undefined;
}

function onVisibilityChange(): void {
  if (documentHidden()) stop();
  else start();
}

function subscribe(listener: () => void): () => void {
  ticker.listeners.add(listener);
  if (ticker.listeners.size === 1) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    start();
  }
  return () => {
    ticker.listeners.delete(listener);
    if (ticker.listeners.size > 0) return;
    stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

const subscribeNothing = (): (() => void) => () => undefined;

/**
 * While the timer runs, the published time. Otherwise (no clock mounted yet, or the tab
 * hidden) the current whole second, so a clock's first paint is already right instead
 * of flashing a stale time until its subscription lands after paint. Floored to the
 * second, the value is stable for every render within that second, which is what
 * `useSyncExternalStore` requires of a snapshot.
 */
function getSnapshot(): number {
  return ticker.timer === undefined ? wholeSecond(Date.now()) : ticker.now;
}

/** No clock runs on the server; a run's clock starts on the client. */
const getServerSnapshot = (): number => 0;

/**
 * The shared clock's time (epoch ms, floored to the second), re-rendering the caller once
 * a second while `enabled` and not under a paused panel. A finished run passes `false`:
 * its time is frozen, so it neither re-renders nor keeps the timer alive.
 */
export function useTicker(enabled = true): number {
  const paused = use(TickerPausedContext);
  return useSyncExternalStore(
    enabled && !paused ? subscribe : subscribeNothing,
    getSnapshot,
    getServerSnapshot,
  );
}
