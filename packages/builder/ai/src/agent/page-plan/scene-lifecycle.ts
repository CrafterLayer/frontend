import {
  finding,
  firstLiteralArgument,
  isPageTarget,
  matchesOf,
  receiverOf,
  type SceneSource,
} from './scene-source';
import type { SectionCheckIssue } from './types';

/*
  The scene check's lifecycle rules (check-scene.ts): what a scene adds that
  outlives its stage must end in ck.onDispose, and a loop the runtime does not
  calm by itself must be guarded with ck.reducedMotion; keys are never taken
  from the page where the editor canvas types. The stage itself, app.ticker
  callbacks, app.renderer listeners and everything under ck.scene's s.tick,
  s.fixedTick and s.dispose are the runtime's to end and never count here.
*/

// ── Cleanup: what outlives the stage must end in ck.onDispose ────────────────

const DISPOSE = /\.\s*(?:onDispose|dispose)\s*\(\s*[^\s)]/u;
const ADD_LISTENER = /(?<![\w$])addEventListener\s*\(/gu;
const REMOVE_LISTENER = /(?<![\w$])removeEventListener\s*\(/gu;
const LISTENER_OPTIONS = /\b(?:signal|once)\s*:/u;
const INTERVAL = /(?<![\w$])setInterval\s*\(/u;
const CLEAR_INTERVAL = /(?<![\w$])clearInterval\s*\(/u;
const RAF = /(?<![\w$])requestAnimationFrame\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/gu;
const CANCEL_RAF = /(?<![\w$])cancelAnimationFrame\s*\(/u;
const OBSERVER =
  /\bnew\s+(IntersectionObserver|ResizeObserver|MutationObserver|PerformanceObserver)\s*\(/u;
const DISCONNECT = /\.\s*disconnect\s*\(/u;
const OWN_TICKER = /\bTicker\s*\.\s*shared\b|\bnew\s+(?:[\w$]+\s*\.\s*)?Ticker\s*\(/u;
const TICKER_RELEASE = /\.\s*(?:remove|destroy)\s*\(/u;
const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress']);

/** The index of a `requestAnimationFrame(f)` inside the function `f` it schedules: a loop. */
function rafLoop(source: SceneSource): number | undefined {
  for (const match of matchesOf(source, RAF)) {
    const name = (match[1] ?? '').replace(/\$/gu, '\\$');
    const defined = new RegExp(
      `function\\s+${name}\\s*\\(|(?<![\\w$.])${name}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^()]*\\)\\s*=>|[\\w$]+\\s*=>)`,
      'u',
    ).exec(source.bare);
    if (defined !== null && defined.index < match.index) return match.index;
  }
  return undefined;
}

interface Listener {
  readonly index: number;
  readonly target: string;
  readonly type: string | undefined;
}

function listeners(source: SceneSource, pattern: RegExp): readonly Listener[] {
  return matchesOf(source, pattern).map((match) => ({
    index: match.index,
    target: receiverOf(source.bare, match.index),
    type: firstLiteralArgument(source, match.index + match[0].length - 1)?.text,
  }));
}

export function cleanupFindings(source: SceneSource): readonly SectionCheckIssue[] {
  const { bare } = source;
  const added = listeners(source, ADD_LISTENER);
  const removed = listeners(source, REMOVE_LISTENER);
  const interval = INTERVAL.exec(bare);
  const loop = rafLoop(source);
  const observer = OBSERVER.exec(bare);
  const ticker = OWN_TICKER.exec(bare);
  const owned = [added[0]?.index, interval?.index, loop, observer?.index, ticker?.index].filter(
    (index): index is number => index !== undefined,
  );
  if (owned.length === 0) return [];
  if (!DISPOSE.test(bare)) {
    return [
      finding(
        'scene-cleanup',
        'Register a cleanup with ck.onDispose(()=>{…}) (s.dispose under ck.scene): the code adds listeners, timers, observers or a ticker that outlive the stage, and nothing removes them when the region re-runs or leaves the page.',
        source,
        Math.min(...owned),
      ),
    ];
  }
  const findings: SectionCheckIssue[] = [];
  const optioned = LISTENER_OPTIONS.test(bare);
  const removedTypes = new Set(removed.map(({ type }) => type));
  const unmatched = removedTypes.has(undefined)
    ? []
    : added.filter(({ type }) => type !== undefined && !removedTypes.has(type));
  const missing = removed.length === 0 ? added : unmatched;
  if (missing[0] !== undefined && !optioned) {
    const types = [...new Set(missing.map(({ type }) => type ?? 'its'))].join(', ');
    findings.push(
      finding(
        'scene-cleanup',
        `Remove the ${types} listener${missing.length === 1 ? '' : 's'} in ck.onDispose(()=>el.removeEventListener(type,fn)) (s.dispose under ck.scene): a listener on the page or the tree outlives the stage, and every re-run of the region adds another.`,
        source,
        missing[0].index,
      ),
    );
  }
  if (interval !== null && !CLEAR_INTERVAL.test(bare)) {
    findings.push(
      finding(
        'scene-cleanup',
        'Clear the interval in ck.onDispose(()=>clearInterval(id)) — or animate on app.ticker / s.tick, which the runtime stops for you.',
        source,
        interval.index,
      ),
    );
  }
  if (loop !== undefined && !CANCEL_RAF.test(bare)) {
    findings.push(
      finding(
        'scene-cleanup',
        'Cancel the requestAnimationFrame loop in ck.onDispose(()=>cancelAnimationFrame(id)) — or move it to app.ticker / s.tick, which the runtime stops for you.',
        source,
        loop,
      ),
    );
  }
  if (observer !== null && !DISCONNECT.test(bare)) {
    findings.push(
      finding(
        'scene-cleanup',
        `Disconnect the ${observer[1] ?? 'observer'} in ck.onDispose(()=>observer.disconnect()).`,
        source,
        observer.index,
      ),
    );
  }
  if (ticker !== null && !TICKER_RELEASE.test(bare)) {
    findings.push(
      finding(
        'scene-cleanup',
        'Animate on app.ticker (ck.stage) or s.tick (ck.scene), not on PIXI.Ticker.shared or a Ticker of your own: those outlive the region — or remove the callback in ck.onDispose.',
        source,
        ticker.index,
      ),
    );
  }
  return findings;
}

// ── Guards the runtime offers: reduced motion and the editor canvas ──────────

const TICKER_LOOP = /\bticker\s*\.\s*add\s*\(/u;
const REDUCED = /\breducedMotion\b/u;
const EDITOR = /\beditor\b/u;

export function guardFindings(source: SceneSource): readonly SectionCheckIssue[] {
  const { bare } = source;
  const findings: SectionCheckIssue[] = [];
  // Frame loops only: an interval may be a clock, not motion.
  const motion = [TICKER_LOOP.exec(bare)?.index, rafLoop(source)].filter(
    (index): index is number => index !== undefined,
  );
  const calm =
    REDUCED.test(bare) ||
    source.literals.some(({ text }) => text.includes('prefers-reduced-motion'));
  if (motion.length > 0 && !calm) {
    findings.push(
      finding(
        'scene-guard',
        'Guard the animation with ck.reducedMotion (s.reducedMotion under ck.scene): when it is true draw one finished frame and start no loop — if(!ck.reducedMotion)app.ticker.add(…).',
        source,
        Math.min(...motion),
      ),
    );
  }
  const keys = listeners(source, ADD_LISTENER).find(
    ({ target, type }) => isPageTarget(target) && type !== undefined && KEY_EVENTS.has(type),
  );
  if (keys !== undefined && !EDITOR.test(bare)) {
    findings.push(
      finding(
        'scene-guard',
        'Do not listen for keys on window or document: on the editor canvas that takes the person’s typing. Use s.input under ck.scene (keys reach only a focused canvas), or listen on the canvas and return early when ck.editor.',
        source,
        keys.index,
      ),
    );
  }
  return findings;
}
