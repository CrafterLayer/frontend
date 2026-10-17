import { afterEach, describe, expect, it } from 'vitest';

import { normalizeArabic } from '../intent/normalize-arabic';

import {
  CK_USER_LINE_OFFSET,
  ckPrelude,
  type CkPrelude,
  type CkPreludeInput,
} from './ck-prelude.js';
import { DEFAULT_SCRIPT_LIMITS } from './limits';
import type { ScriptElement, ScriptLimits, ScriptPage, ScriptPhoto } from './types';

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

/** What script-host's element-index stores as `norm`. */
function hostNorm(text: string): string {
  return normalizeArabic(text).toLowerCase();
}

function el(
  id: string,
  kind: ScriptElement['kind'],
  text: string,
  section: string,
  sectionId: string,
  page = 'home',
  extra: Partial<ScriptElement> = {},
): ScriptElement {
  return {
    id,
    kind,
    text,
    norm: hostNorm(text),
    node: `n-${id}`,
    section,
    sectionId,
    page,
    ...extra,
  };
}

const ELEMENTS: readonly ScriptElement[] = [
  el('s1', 'section', '', 'الرئيسية', 'hero'),
  el('h1', 'heading', 'مَرحـــباً بكم في مطعمنا', 'الرئيسية', 'hero', 'home', { tag: 'h1' }),
  el('b1', 'button', 'احجز طاولة', 'الرئيسية', 'hero'),
  el('s2', 'section', '', 'قائمة الطعام', 'menu'),
  el('h2', 'heading', 'أطباقنا المميزة', 'قائمة الطعام', 'menu', 'home', { tag: 'h2' }),
  el('t1', 'text', 'حمص بالطحينة', 'قائمة الطعام', 'menu'),
  el('b2', 'button', 'اطلب الآن', 'قائمة الطعام', 'menu'),
  el('i1', 'image', '', 'قائمة الطعام', 'menu', 'home', { src: 'https://x/1.jpg', alt: 'hummus' }),
  el('h3', 'heading', 'Our Menu', 'Menu', 'menu-en', 'menu-page'),
  el('b3', 'button', 'Order now', 'Menu', 'menu-en', 'menu-page'),
];

const PAGES: readonly ScriptPage[] = [
  { id: 'home', title: 'الرئيسية', slug: 'home', lang: 'ar', dir: 'rtl', current: true },
  { id: 'menu-page', title: 'Menu', slug: 'menu', lang: 'en', dir: 'ltr', current: false },
];

const PHOTOS: readonly ScriptPhoto[] = [
  { topic: 'restaurant', src: 'r1', alt: 'A table set for dinner' },
  { topic: 'restaurant', src: 'r2', alt: 'Chef plating hummus' },
  { topic: 'restaurant', src: 'r3', alt: 'Grilled kebab' },
  { topic: 'restaurant', src: 'r4', alt: 'Fresh bread' },
  { topic: 'cafe', src: 'c1', alt: 'Latte art' },
  { topic: 'real estate', src: 'e1', alt: 'Modern villa' },
];

const TOOLS = ['element.style', 'element.attr', 'kit.insert', 'part.list', 'script.run'];

type InputOverrides = Partial<Omit<CkPreludeInput, 'limits'>> & { limits?: Partial<ScriptLimits> };

function input(overrides: InputOverrides = {}): CkPreludeInput {
  return {
    elements: ELEMENTS,
    pages: PAGES,
    photos: PHOTOS,
    tools: TOOLS,
    locale: { lang: 'ar', dir: 'rtl' },
    seed: 42,
    now: NOW,
    ...overrides,
    limits: { ...DEFAULT_SCRIPT_LIMITS, ...overrides.limits },
  };
}

const open: CkPrelude[] = [];
function prelude(overrides: InputOverrides = {}): CkPrelude {
  const p = ckPrelude(input(overrides));
  open.push(p);
  return p;
}

afterEach(() => {
  // The prelude swaps Math.random and Date (meant for the sandbox's own globals).
  while (open.length > 0) open.pop()?.restore();
});

interface Out {
  ok: boolean;
  calls?: {
    n: number;
    line?: number;
    op: string;
    targets?: string[];
    name?: string;
    input?: unknown;
    page?: string;
  }[];
  result?: string;
  notes: string[];
  error?: {
    code: string;
    detail: {
      message?: string;
      n?: number;
      line?: number;
      suggestion?: string;
      name?: string;
      tools?: string[];
    };
  };
  stats: { calls: number; found: number };
}

function finish(p: CkPrelude, value?: unknown): Out {
  return JSON.parse(p.finish(value)) as Out;
}

function failed(p: CkPrelude, action: () => unknown): Out {
  try {
    action();
  } catch (error) {
    return JSON.parse(p.fail(error, 'run')) as Out;
  }
  throw new Error('expected the call to throw');
}

/** Run `code` the way the sandbox wrapper does, but in V8 (same `new Function` line offset). */
function runLikeWrapper(p: CkPrelude, code: string): Out {
  let phase: 'compile' | 'run' = 'compile';
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- mirrors the sandbox wrapper; test-only code
    const fn = new Function('ck', code) as (ck: unknown) => unknown;
    phase = 'run';
    return JSON.parse(p.finish(fn(p.api))) as Out;
  } catch (error) {
    return JSON.parse(p.fail(error, phase)) as Out;
  }
}

describe('ckPrelude: self-containment', () => {
  it('survives toString() + new Function (no closure over module scope)', () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the self-containment contract itself
    const factory = new Function(`return ${ckPrelude.toString()}`) as () => typeof ckPrelude;
    const rebuilt = factory();
    const p = rebuilt(input());
    open.push(p);
    p.api.style(p.api.find({ kind: 'button' }), { borderRadius: 'full' });
    const out = finish(p);
    expect(out.ok).toBe(true);
    expect(out.calls?.[0]?.targets).toEqual(['b1', 'b2']);
  });

  it('pins the new Function line offset at 2', () => {
    expect(CK_USER_LINE_OFFSET).toBe(2);
  });
});

describe('ck.find', () => {
  it('filters by one kind or an array of kinds, on the current page by default', () => {
    const { api } = prelude();
    expect(api.find({ kind: 'button' }).map((e) => e.id)).toEqual(['b1', 'b2']);
    expect(api.find({ kind: ['heading', 'image'] }).map((e) => e.id)).toEqual(['h1', 'h2', 'i1']);
    expect(api.find().length).toBe(8);
  });

  it('matches text across Arabic spelling variants (hamza, taa marbuta, tatweel, harakat)', () => {
    const { api } = prelude();
    expect(api.find({ text: 'اطباقنا' }).map((e) => e.id)).toEqual(['h2']);
    expect(api.find({ text: 'قائمه' }).map((e) => e.id)).toEqual([]); // text, not section label
    expect(api.find({ text: 'مرحبا' }).map((e) => e.id)).toEqual(['h1']);
    expect(api.find({ text: 'مرحـبـاً' }).map((e) => e.id)).toEqual(['h1']);
    expect(api.find({ text: 'الان' }).map((e) => e.id)).toEqual(['b2']);
  });

  it('matches a section by label (contains, normalized) or by section id', () => {
    const { api } = prelude();
    expect(api.find({ kind: 'button', section: 'قائمه' }).map((e) => e.id)).toEqual(['b2']);
    expect(api.find({ kind: 'button', section: 'hero' }).map((e) => e.id)).toEqual(['b1']);
  });

  it('selects pages by id, slug or "*"', () => {
    const { api } = prelude();
    expect(api.find({ kind: 'button', page: 'menu' }).map((e) => e.id)).toEqual(['b3']);
    expect(api.find({ kind: 'button', page: 'menu-page' }).map((e) => e.id)).toEqual(['b3']);
    expect(api.find({ kind: 'button', page: '*' }).map((e) => e.id)).toEqual(['b1', 'b2', 'b3']);
    expect(() => api.find({ page: 'nope' })).toThrow(/no page "nope"/u);
  });

  it('rejects unknown filters and kinds instead of matching everything', () => {
    const { api } = prelude();
    expect(() => api.find({ type: 'button' } as never)).toThrow(/unknown filter "type"/u);
    expect(() => api.find({ kind: 'btn' } as never)).toThrow(/unknown kind "btn"/u);
  });

  it('caps results at maxFind, sets find.truncated and notes it once', () => {
    const p = prelude({ limits: { maxFind: 2 } });
    expect(p.api.find().length).toBe(2);
    expect(p.api.find.truncated).toBe(true);
    p.api.find({ kind: 'heading' });
    expect(p.api.find.truncated).toBe(false);
    p.api.find();
    const out = finish(p);
    expect(out.notes).toEqual(['find() returned the first 2; narrow with page/section/kind']);
    expect(out.stats.found).toBe(6);
  });

  it('returns frozen elements so a script cannot forge an id', () => {
    const { api } = prelude();
    const [button] = api.find({ kind: 'button' });
    expect(Object.isFrozen(button)).toBe(true);
    expect(Object.isFrozen(api)).toBe(true);
  });
});

describe('writes: set / style / tool', () => {
  it('records calls in order with n, op and targets (element, array or find result)', () => {
    const p = prelude();
    const { api } = p;
    const [h1] = api.find({ kind: 'heading' });
    api.set(h1!, { text: 'أهلاً' });
    api.style(
      api.find({ kind: 'button' }),
      { borderRadius: 'full', textColor: 'accent' },
      { bucket: 'mobile' },
    );
    api.tool('kit.insert', { kit: 'menu-list', into: 's2' });
    const out = finish(p);
    expect(out.ok).toBe(true);
    expect(out.calls).toEqual([
      { n: 1, op: 'set', targets: ['h1'], value: { text: 'أهلاً' } },
      {
        n: 2,
        op: 'style',
        targets: ['b1', 'b2'],
        styles: { borderRadius: 'full', textColor: 'accent' },
        options: { bucket: 'mobile' },
      },
      { n: 3, op: 'tool', name: 'kit.insert', input: { kit: 'menu-list', into: 's2' } },
    ]);
  });

  it('records the caller line of each call', () => {
    const out = runLikeWrapper(
      prelude(),
      "const b = ck.find({kind:'button'});\nck.style(b, {borderRadius:'full'});\n\nb.forEach(x => ck.set(x, {text:'x'}));",
    );
    expect(out.calls?.map((c) => [c.n, c.line])).toEqual([
      [1, 2],
      [2, 4],
      [3, 4],
    ]);
  });

  it('dedupes targets and skips an empty list without queuing', () => {
    const p = prelude();
    const [b1] = p.api.find({ kind: 'button' });
    expect(p.api.style([b1!, b1!, 'b1'], { gap: '4' })).toBe(1);
    expect(p.api.set([], { text: 'x' })).toBe(0);
    expect(finish(p).calls).toHaveLength(1);
  });

  it('E_BAD_TARGET for an id the script made up, sticky even when caught', () => {
    const p = prelude();
    const out = failed(p, () => p.api.set('made-up', { text: 'x' }));
    expect(out.error?.code).toBe('E_BAD_TARGET');
    expect(out.error?.detail.message).toContain('"made-up"');
    expect(out.error?.detail.n).toBe(1);

    const q = prelude();
    try {
      q.api.style([undefined as never], { gap: '1' });
    } catch {
      // the script swallowed it
    }
    const after = finish(q, 'done');
    expect(after.ok).toBe(false);
    expect(after.error?.code).toBe('E_BAD_TARGET');
    expect(after.error?.detail.message).toContain('undefined');
  });

  it('E_NO_TOOL with did-you-mean and the lane tools (never script.run)', () => {
    const p = prelude();
    const out = failed(p, () => p.api.tool('elment.style', {}));
    expect(out.error?.code).toBe('E_NO_TOOL');
    expect(out.error?.detail).toMatchObject({
      n: 1,
      name: 'elment.style',
      suggestion: 'element.style',
      tools: ['element.style', 'element.attr', 'kit.insert', 'part.list'],
    });
    const q = prelude();
    expect(failed(q, () => q.api.tool('script.run', { code: '' })).error?.code).toBe('E_NO_TOOL');
    const r = prelude();
    expect(failed(r, () => r.api.tool('zzzzzzzz')).error?.detail.suggestion).toBeUndefined();
  });

  it('snapshots tool input and resolves a target page', () => {
    const p = prelude();
    const data = { items: [1, 2] };
    p.api.tool('part.list', data, { page: 'menu' });
    data.items.push(3);
    expect(finish(p).calls?.[0]).toMatchObject({ input: { items: [1, 2] }, page: 'menu-page' });
    const q = prelude();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => q.api.tool('part.list', cyclic)).toThrow(/plain JSON data/u);
  });

  it('validates set fields and style values with fix-it messages', () => {
    const { api } = prelude();
    const b = api.find({ kind: 'button' });
    expect(() => api.set(b, { color: 'red' } as never)).toThrow(/unknown field "color"/u);
    expect(() => api.set(b, {})).toThrow(/at least one/u);
    expect(() => api.style(b, {})).toThrow(/at least one style/u);
    expect(() => api.style(b, { gap: { value: '2', bucket: 'phone' } } as never)).toThrow(
      /bucket/u,
    );
    expect(
      api.style(b, { gap: { value: '2', bucket: 'tablet', state: 'hover' }, padding: null }),
    ).toBe(2);
  });
});

describe('limits', () => {
  it('E_LIMIT_CALLS past maxCalls ck calls', () => {
    const p = prelude({ limits: { maxCalls: 3 } });
    p.api.pages();
    p.api.pages();
    p.api.pages();
    expect(failed(p, () => p.api.pages()).error?.code).toBe('E_LIMIT_CALLS');
  });

  it('E_LIMIT_STEPS past maxSteps queued writes', () => {
    const p = prelude({ limits: { maxSteps: 2 } });
    const b = p.api.find({ kind: 'button' });
    p.api.style(b, { gap: '1' });
    p.api.style(b, { gap: '2' });
    const out = failed(p, () => p.api.style(b, { gap: '3' }));
    expect(out.error).toMatchObject({ code: 'E_LIMIT_STEPS', detail: { n: 3 } });
  });

  it('E_LIMIT_STEPS past maxTargets named elements', () => {
    const p = prelude({ limits: { maxTargets: 3 } });
    const b = p.api.find({ kind: 'button' });
    p.api.style(b, { gap: '1' });
    expect(failed(p, () => p.api.style(b, { gap: '2' })).error?.code).toBe('E_LIMIT_STEPS');
  });

  it('keeps at most maxNotes notes of at most maxNoteChars', () => {
    const p = prelude();
    for (let i = 0; i < 7; i += 1) p.api.note(`note ${String(i)}`);
    p.api.note('x'.repeat(500));
    const out = finish(p);
    expect(out.notes).toEqual(['note 0', 'note 1', 'note 2', 'note 3', 'note 4']);
    const q = prelude();
    q.api.note('y'.repeat(500));
    expect(finish(q).notes[0]).toHaveLength(200);
  });
});

describe('ck.fmt', () => {
  it('formats numbers with latn digits by default and arab digits on request', () => {
    const { api } = prelude();
    expect(api.fmt.num(8)).toBe('8');
    expect(api.fmt.num(1234567)).toBe('1,234,567');
    expect(api.fmt.num(1234.5)).toBe('1,234.50');
    expect(api.fmt.num(1234.5, { digits: 'arab' })).toBe('١٬٢٣٤٫٥٠');
    expect(api.fmt.num(8, { digits: 'arab' })).toBe('٨');
    expect(api.fmt.num(3.14159, { decimals: 3 })).toBe('3.142');
    expect(api.fmt.num(7, { decimals: 2 })).toBe('7.00');
    expect(api.fmt.num(-1500)).toBe('-1,500');
    expect(api.fmt.num('12')).toBe('12');
    expect(() => api.fmt.num(Number.NaN)).toThrow(/finite number/u);
    expect(() => api.fmt.num(1, { digits: 'roman' } as never)).toThrow(/digits/u);
  });

  const CURRENCIES: readonly (readonly [string, string, string])[] = [
    ['JOD', '8 د.أ', 'JOD 8'],
    ['SAR', '8 ر.س', 'SAR 8'],
    ['AED', '8 د.إ', 'AED 8'],
    ['EGP', '8 ج.م', 'EGP 8'],
    ['KWD', '8 د.ك', 'KWD 8'],
    ['QAR', '8 ر.ق', 'QAR 8'],
    ['BHD', '8 د.ب', 'BHD 8'],
    ['OMR', '8 ر.ع', 'OMR 8'],
    ['USD', '8 $', '$8'],
    ['EUR', '8 €', '€8'],
    ['GBP', '8 £', '£8'],
  ];

  it.each(CURRENCIES)('money %s in Arabic and English', (code, arabic, english) => {
    const ar = prelude({ locale: { lang: 'ar', dir: 'rtl' } }).api;
    expect(ar.fmt.money(8, code)).toBe(arabic);
    const en = prelude({ locale: { lang: 'en', dir: 'ltr' } }).api;
    expect(en.fmt.money(8, code)).toBe(english);
  });

  it('money: arab digits, decimals, lang override, defaults and errors', () => {
    const ar = prelude().api;
    expect(ar.fmt.money(8, 'JOD', { digits: 'arab' })).toBe('٨ د.أ');
    expect(ar.fmt.money(12.5, 'SAR')).toBe('12.50 ر.س');
    expect(ar.fmt.money(1200, 'jod', { lang: 'en' })).toBe('JOD 1,200');
    expect(ar.fmt.money(5)).toBe('5 د.أ');
    expect(ar.fmt.money(-3, 'USD', { lang: 'en' })).toBe('-$3');
    expect(prelude({ locale: { lang: 'en', dir: 'ltr' } }).api.fmt.money(5)).toBe('$5');
    expect(() => ar.fmt.money(1, 'XYZ')).toThrow(/unknown currency "XYZ"/u);
  });
});

describe('ck.photos', () => {
  it('rotates deterministically with no repeats until the topic is exhausted', () => {
    const a = prelude({ seed: 7 }).api;
    const first = a.photos('restaurant', 2).map((p) => p.src);
    const second = a.photos('restaurant', 2).map((p) => p.src);
    expect(new Set([...first, ...second]).size).toBe(4);
    const again = a.photos('restaurant', 2).map((p) => p.src);
    expect(again).toEqual(first);
    const b = prelude({ seed: 7 }).api;
    expect(b.photos('restaurant', 2).map((p) => p.src)).toEqual(first);
  });

  it('matches a topic or a word in the alt text, defaults to 6, caps at the pool and 24', () => {
    const { api } = prelude();
    expect(api.photos('hummus').map((p) => p.src)).toEqual(['r2']);
    expect(api.photos('realestate').map((p) => p.src)).toEqual(['e1']);
    expect(api.photos().length).toBe(6);
    expect(api.photos('restaurant', 100).length).toBe(4);
    expect(api.photos('restaurant')[0]).toEqual({
      src: expect.any(String) as unknown,
      alt: expect.any(String) as unknown,
    });
    expect(() => api.photos('spaceships')).toThrow(/Topics: restaurant, cafe, real estate/u);
    expect(prelude({ photos: [] }).api.photos('x')).toEqual([]);
  });
});

describe('determinism', () => {
  it('seeds Math.random from the seed (same seed, same sequence)', () => {
    const p1 = prelude({ seed: 123 });
    const run1 = [Math.random(), Math.random(), Math.random()];
    p1.restore();
    const p2 = prelude({ seed: 123 });
    const run2 = [Math.random(), Math.random(), Math.random()];
    p2.restore();
    const p3 = prelude({ seed: 124 });
    const run3 = [Math.random(), Math.random(), Math.random()];
    p3.restore();
    expect(run1).toEqual(run2);
    expect(run3).not.toEqual(run1);
    for (const value of run1) expect(value >= 0 && value < 1).toBe(true);
  });

  it('freezes Date.now, new Date() and Date() to `now`, and restore() puts them back', () => {
    const p = prelude();
    expect(Date.now()).toBe(NOW);
    expect(new Date().getTime()).toBe(NOW);
    expect(new Date(5).getTime()).toBe(5);
    expect(new Date() instanceof Date).toBe(true);
    expect(typeof Date()).toBe('string');
    p.restore();
    expect(Date.now()).not.toBe(NOW);
  });
});

describe('normalize parity with the host norm (normalizeArabic + lower case)', () => {
  it.each([
    'صفحة',
    'أضف إلكتروني آخر ٱلموقع',
    'على مستوى',
    'مـوقـــع',
    'مَوْقِعٌ غيّر',
    'هٰذا',
    'ی ک',
    'من ٤ صفحات',
    'Hello  World؟',
    '  Our MENU ',
  ])('%s', (text) => {
    expect(prelude().normalize(text)).toBe(hostNorm(text));
  });
});

describe('finish / fail', () => {
  it('returns a string result as-is and a value as JSON', () => {
    expect(finish(prelude(), 'rounded 3 buttons').result).toBe('rounded 3 buttons');
    expect(finish(prelude(), { count: 3 }).result).toBe('{"count":3}');
    expect(finish(prelude()).result).toBeUndefined();
  });

  it('truncates a big result structurally to maxResultChars', () => {
    const out = finish(prelude(), {
      items: Array.from({ length: 200 }, (_, i) => `item ${String(i)}`),
    });
    expect(out.result!.length).toBeLessThanOrEqual(DEFAULT_SCRIPT_LIMITS.maxResultChars);
    expect(out.result).toContain('--- TRUNCATED ---');
    expect(() => JSON.parse(out.result!) as unknown).not.toThrow();
  });

  it('maps a compile SyntaxError to E_SYNTAX and other throws to E_RUNTIME with the line', () => {
    const syntax = runLikeWrapper(prelude(), 'let x: number = 1');
    expect(syntax.error?.code).toBe('E_SYNTAX');
    const runtime = runLikeWrapper(prelude(), "const a = 1;\nthrow new Error('boom')");
    expect(runtime.error).toEqual({
      code: 'E_RUNTIME',
      detail: { message: 'Error: boom', line: 2 },
    });
    const odd = runLikeWrapper(prelude(), "throw 'plain'");
    expect(odd.error?.detail.message).toBe('plain');
  });

  it('maps engine-style InternalErrors to E_STACK / E_MEMORY / E_TIMEOUT', () => {
    const internal = (message: string): Error =>
      Object.assign(new Error(message), { name: 'InternalError' });
    expect((JSON.parse(prelude().fail(internal('stack overflow'))) as Out).error?.code).toBe(
      'E_STACK',
    );
    expect((JSON.parse(prelude().fail(internal('out of memory'))) as Out).error?.code).toBe(
      'E_MEMORY',
    );
    expect((JSON.parse(prelude().fail(internal('interrupted'))) as Out).error?.code).toBe(
      'E_TIMEOUT',
    );
  });
});
