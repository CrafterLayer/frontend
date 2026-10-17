/*
  The streamed page plan's reader (DESIGN §5.3, 2026-10-05).

  The planner's answer arrives as raw text while the model is still writing
  it. This reader acts on each finished unit of that text the moment it
  closes — the outline (`pagePlan.sections`) and then each brief — so the
  skeleton lands and section writers start long before the whole answer is
  in.

  Logic-only credit: the "act on each closed unit, never wait for the whole
  answer" pattern is the one bolt.diy's StreamingMessageParser follows
  (stackblitz-labs/bolt.diy, MIT, app/lib/runtime/message-parser.ts: its
  onActionOpen / onActionStream / onActionClose callbacks write each file
  while the next is still being generated). No code is copied and no package
  is added: that parser reads XML-like tags, this one a JSON object. Provenance
  in vendor/VENDOR.md.

  Why no partial-JSON parser: every unit acted on is a COMPLETE JSON value by
  the time it closes, so one `JSON.parse` of its slice is enough. The scanner
  only has to know where a unit starts and ends — strings (with escapes), a
  container stack and the key each container sits under.

  Single pass, O(total length): each character is looked at once, the scan
  position is kept between pushes, and earlier text is only re-read when a
  unit closes (one slice for the head, one per brief).
*/

export type PlanStreamEvent =
  | {
      readonly kind: 'head';
      /** The top-level `rationale`, when its string closed before the outline did. */
      readonly rationale?: string;
      /** `pagePlan`'s keys up to and including `sections`. */
      readonly candidate: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'brief';
      /** The element's position in `pagePlan.briefs`, counting every element. */
      readonly index: number;
      /** One closed element of `pagePlan.briefs`. */
      readonly brief: Readonly<Record<string, unknown>>;
    };

export interface PlanStreamReader {
  /** Feed the next text; returns the events it completed, in order. */
  push(text: string): readonly PlanStreamEvent[];
  /** A new response began: forget everything read so far. */
  reset(): void;
}

/** One open object or array, from its opening bracket. */
interface Frame {
  readonly type: 'object' | 'array';
  /** Offset of its opening bracket in the kept text. */
  readonly start: number;
  /** The key it sits under in its parent object; undefined inside an array or at the top. */
  readonly key: string | undefined;
  readonly parent: Frame | undefined;
  /** Object: what comes next — a key, the colon, or the value. */
  expect: 'key' | 'colon' | 'value';
  /** Object: the last key read. */
  currentKey: string | undefined;
  /** Array: elements begun so far. */
  count: number;
  /** Array: waiting for an element to begin (after `[` or `,`). */
  awaitingElement: boolean;
  /** Array: the index the element now open was given. */
  elementIndex: number;
}

const OPEN_OBJECT = 0x7b; // {
const CLOSE_OBJECT = 0x7d; // }
const OPEN_ARRAY = 0x5b; // [
const CLOSE_ARRAY = 0x5d; // ]
const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \
const COLON = 0x3a; // :
const COMMA = 0x2c; // ,

function isWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSlice(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Keys a bare plan's top-level object carries that are not the plan's own. */
const WRAPPER_KEYS: ReadonlySet<string> = new Set(['version', 'rationale']);

/**
 * A reader of the streamed plan answer (DESIGN §5.3).
 *
 * - Skips everything before the first `{` (a code fence, a sentence).
 * - `head` fires once, when the `sections` array of `pagePlan` closes — or
 *   of the top-level object, when the model forgot the wrapper.
 * - `brief` fires per closed element of `pagePlan.briefs`, with its index.
 * - A slice that does not parse emits nothing: that unit waits for the final
 *   plan. Reading continues with the next one.
 * - After the top-level object closes, further text is ignored.
 */
export function createPlanStreamReader(): PlanStreamReader {
  // The kept text, from the first `{`, as chunks joined only when a unit closes.
  let parts: string[] = [];
  let length = 0;
  let started = false;
  let finished = false;

  let stack: Frame[] = [];
  let top: Frame | undefined;
  let plan: Frame | undefined;

  let inString = false;
  let escaped = false;
  let stringIsKey = false;
  // Raw characters of the string being captured (a key, or the top-level rationale).
  let capture: string[] | undefined;

  let rationale: string | undefined;
  let headDone = false;

  function text(): string {
    if (parts.length > 1) parts = [parts.join('')];
    return parts[0] ?? '';
  }

  function reset(): void {
    parts = [];
    length = 0;
    started = false;
    finished = false;
    stack = [];
    top = undefined;
    plan = undefined;
    inString = false;
    escaped = false;
    stringIsKey = false;
    capture = undefined;
    rationale = undefined;
    headDone = false;
  }

  /** The frame `sections` and `briefs` belong to: `pagePlan`, or the top object without one. */
  function isPlanFrame(frame: Frame | undefined): boolean {
    if (frame === undefined) return false;
    if (plan !== undefined) return frame === plan;
    return frame === top;
  }

  /** A value begins in the innermost frame: inside an array, it is the next element. */
  function beginValue(): void {
    const frame = stack[stack.length - 1];
    if (frame === undefined) return;
    if (frame.type === 'array' && frame.awaitingElement) {
      frame.elementIndex = frame.count;
      frame.count += 1;
      frame.awaitingElement = false;
    }
  }

  function open(type: 'object' | 'array', offset: number): void {
    const parent = stack[stack.length - 1];
    beginValue();
    const key =
      parent?.type === 'object' && parent.expect === 'value'
        ? parent.currentKey
        : undefined;
    const frame: Frame = {
      type,
      start: offset,
      key,
      parent,
      expect: 'key',
      currentKey: undefined,
      count: 0,
      awaitingElement: true,
      elementIndex: -1,
    };
    stack.push(frame);
    if (parent === undefined) top = frame;
    else if (type === 'object' && parent === top && key === 'pagePlan' && plan === undefined) {
      plan = frame;
    }
  }

  function close(offset: number, events: PlanStreamEvent[]): void {
    const frame = stack.pop();
    if (frame === undefined) return;
    const parent = frame.parent;
    if (parent === undefined) {
      finished = true;
      return;
    }
    if (
      !headDone &&
      frame.type === 'array' &&
      frame.key === 'sections' &&
      isPlanFrame(parent)
    ) {
      headDone = true;
      const candidate = parseSlice(`${text().slice(parent.start, offset + 1)}}`);
      if (isPlainRecord(candidate)) {
        const own =
          parent === top && plan === undefined
            ? Object.fromEntries(
                Object.entries(candidate).filter(([key]) => !WRAPPER_KEYS.has(key)),
              )
            : candidate;
        events.push({
          kind: 'head',
          ...(rationale === undefined ? {} : { rationale }),
          candidate: own,
        });
      }
    }
    if (
      frame.type === 'object' &&
      parent.type === 'array' &&
      parent.key === 'briefs' &&
      isPlanFrame(parent.parent)
    ) {
      const brief = parseSlice(text().slice(frame.start, offset + 1));
      if (isPlainRecord(brief)) events.push({ kind: 'brief', index: parent.elementIndex, brief });
    }
  }

  function closeString(): void {
    const frame = stack[stack.length - 1];
    const raw = capture;
    capture = undefined;
    if (frame?.type !== 'object') return;
    if (stringIsKey) {
      const key = raw === undefined ? undefined : parseSlice(`"${raw.join('')}"`);
      frame.currentKey = typeof key === 'string' ? key : undefined;
      frame.expect = 'colon';
      return;
    }
    if (raw !== undefined && frame === top && frame.currentKey === 'rationale') {
      const value = parseSlice(`"${raw.join('')}"`);
      if (typeof value === 'string') rationale = value;
    }
  }

  /** Scan `chunk`, whose first character sits at `base` in the kept text. */
  function scan(chunk: string, base: number, events: PlanStreamEvent[]): void {
    for (let index = 0; index < chunk.length && !finished; index += 1) {
      const code = chunk.charCodeAt(index);
      if (inString) {
        if (escaped) escaped = false;
        else if (code === BACKSLASH) escaped = true;
        else if (code === QUOTE) {
          inString = false;
          closeString();
          continue;
        }
        capture?.push(chunk[index] ?? '');
        continue;
      }
      if (isWhitespace(code)) continue;
      const frame = stack[stack.length - 1];
      if (code === QUOTE) {
        inString = true;
        escaped = false;
        stringIsKey = frame?.type === 'object' && frame.expect === 'key';
        if (!stringIsKey) beginValue();
        capture =
          stringIsKey ||
          (frame !== undefined && frame === top && frame.currentKey === 'rationale')
            ? []
            : undefined;
        continue;
      }
      if (code === OPEN_OBJECT) open('object', base + index);
      else if (code === OPEN_ARRAY) open('array', base + index);
      else if (code === CLOSE_OBJECT || code === CLOSE_ARRAY) close(base + index, events);
      else if (code === COLON) {
        if (frame?.type === 'object') frame.expect = 'value';
      } else if (code === COMMA) {
        if (frame?.type === 'object') {
          frame.expect = 'key';
          frame.currentKey = undefined;
        } else if (frame?.type === 'array') frame.awaitingElement = true;
      } else beginValue(); // a number, true, false, null — or junk the parse will refuse
    }
  }

  function push(chunk: string): readonly PlanStreamEvent[] {
    if (finished || chunk === '') return [];
    let from = 0;
    if (!started) {
      const first = chunk.indexOf('{');
      if (first === -1) return [];
      started = true;
      from = first;
    }
    const kept = from === 0 ? chunk : chunk.slice(from);
    const base = length;
    parts.push(kept);
    length += kept.length;
    const events: PlanStreamEvent[] = [];
    scan(kept, base, events);
    return events;
  }

  return { push, reset };
}
