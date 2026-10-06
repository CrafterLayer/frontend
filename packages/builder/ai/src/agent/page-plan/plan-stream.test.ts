import { describe, expect, it } from 'vitest';

import { createPlanStreamReader, type PlanStreamEvent } from './plan-stream';

/*
  The streamed plan's reader (DESIGN §5.3): whatever the chunking, the same
  text gives the same events — the outline once, then each brief as it
  closes — and a unit that does not parse is skipped without derailing the
  rest.
*/

/** The compact plan example, DESIGN §3, verbatim. */
const EXAMPLE = `{
  "version": 1,
  "rationale": "A warm, type-led roastery page: burnt orange on pale lime, Fraunces headings.",
  "pagePlan": {
    "intent": "new-page",
    "locale": { "lang": "en", "dir": "ltr" },
    "title": "Cardamom Roasters — specialty coffee in Amman",
    "description": "Small-batch coffee roasted every morning in Amman, delivered fresh.",
    "tokens": { "deckRowId": "cafe", "signature": "The brand name at text-8xl, faint behind the menu." },
    "primaryCta": { "label": "Order beans", "href": "#order" },
    "sections": [
      { "key": "header", "role": "header", "title": "Header" },
      { "key": "hero", "role": "hero", "title": "Roasted this morning", "variant": "split" },
      { "key": "menu", "role": "band", "title": "Menu", "variant": "menu", "nav": "Menu" },
      { "key": "order", "role": "cta", "title": "Order", "variant": "cta-split", "nav": "Order" },
      { "key": "footer", "role": "footer", "title": "Footer", "variant": "footer" }
    ],
    "briefs": [
      { "key": "hero", "purpose": "Say what the roastery is and invite the first order.",
        "mustSay": ["Roasted daily in Amman"],
        "images": [{ "subject": "cafe", "aspect": "landscape", "alt": "Freshly roasted coffee beans" }] },
      { "key": "menu", "purpose": "The drinks and beans, with prices.",
        "mustNotRepeat": ["Roasted daily in Amman"],
        "facts": [{ "key": "price-espresso", "sample": "JOD 1.50" }] },
      { "key": "order", "purpose": "One clear way to order.",
        "slots": { "title": "Fresh beans, delivered in Amman",
          "cta": { "label": "Order beans", "href": "#order" } } },
      { "key": "footer", "purpose": "Address, hours and contact.",
        "facts": [{ "key": "phone", "sample": "+962 6 461 2750" }] }
    ],
    "seo": { "keyword": "specialty coffee Amman", "pageKind": "home",
      "businessType": "CafeOrCoffeeShop", "slug": "specialty-coffee-amman" }
  }
}`;

interface ExampleShape {
  rationale: string;
  pagePlan: Record<string, unknown> & { briefs: Record<string, unknown>[] };
}

const PARSED = JSON.parse(EXAMPLE) as ExampleShape;

/** What the head's candidate holds: `pagePlan`'s keys up to and including `sections`. */
function headOf(plan: Record<string, unknown>): Record<string, unknown> {
  const head: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plan)) {
    head[key] = value;
    if (key === 'sections') break;
  }
  return head;
}

function feed(text: string, sizes: (index: number) => number): PlanStreamEvent[] {
  const reader = createPlanStreamReader();
  const events: PlanStreamEvent[] = [];
  let at = 0;
  for (let step = 0; at < text.length; step += 1) {
    const size = Math.max(1, sizes(step));
    events.push(...reader.push(text.slice(at, at + size)));
    at += size;
  }
  return events;
}

/** A small seeded generator (mulberry32), so a failing chunking can be replayed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function expectExampleEvents(events: readonly PlanStreamEvent[]): void {
  expect(events.map(({ kind }) => kind)).toEqual(['head', 'brief', 'brief', 'brief', 'brief']);
  const [head, ...briefs] = events;
  if (head?.kind !== 'head') throw new Error('no head');
  expect(head.rationale).toBe(PARSED.rationale);
  expect(head.candidate).toEqual(headOf(PARSED.pagePlan));
  expect((head.candidate['sections'] as unknown[]).length).toBe(5);
  expect(head.candidate).not.toHaveProperty('briefs');
  expect(
    briefs.map((event) => (event.kind === 'brief' ? [event.index, event.brief] : undefined)),
  ).toEqual(PARSED.pagePlan.briefs.map((brief, index) => [index, brief]));
}

describe('createPlanStreamReader — acting on each closed unit of the plan', () => {
  it('gives the outline, then each brief, from the DESIGN example fed whole', () => {
    expectExampleEvents(createPlanStreamReader().push(EXAMPLE));
  });

  it('gives the same events fed one character at a time', () => {
    expectExampleEvents(feed(EXAMPLE, () => 1));
  });

  it('gives the same events for random chunk sizes', () => {
    for (const seed of [1, 7, 42, 2026, 99_991]) {
      const random = seeded(seed);
      expectExampleEvents(feed(EXAMPLE, () => 1 + Math.floor(random() * 64)));
    }
  });

  it('fires the head as soon as the outline closes, before any brief text arrives', () => {
    const reader = createPlanStreamReader();
    const cut = EXAMPLE.indexOf('"briefs"');
    const early = reader.push(EXAMPLE.slice(0, cut));
    expect(early.map(({ kind }) => kind)).toEqual(['head']);
    const rest = reader.push(EXAMPLE.slice(cut));
    expect(rest.map(({ kind }) => kind)).toEqual(['brief', 'brief', 'brief', 'brief']);
  });

  it('skips a leading code fence and ignores what follows the answer', () => {
    const fenced = `Here is the plan:\n\`\`\`json\n${EXAMPLE}\n\`\`\`\nDone {"not": "read"}`;
    expectExampleEvents(createPlanStreamReader().push(fenced));
    expectExampleEvents(feed(fenced, () => 3));
  });

  it('reads escaped quotes, braces and brackets inside strings, and Arabic text', () => {
    const tricky = {
      rationale: 'دافئ "بلا" {أقواس} [ولا] \\ مائلة',
      pagePlan: {
        intent: 'new-page',
        locale: { lang: 'ar', dir: 'rtl' },
        title: 'مشاوي "الهيل" — {عمّان}',
        description: 'قوس } ومعقوف ] وعلامة " داخل النص',
        tokens: { deckRowId: 'cafe', signature: 'الاسم [كبيراً] خلف "المنيو"' },
        primaryCta: { label: 'اطلب عبر واتساب', href: 'https://wa.me/96264612750' },
        sections: [
          { key: 'header', role: 'header', title: 'الترويسة' },
          { key: 'hero', role: 'hero', title: 'شواء "على الفحم" {كل يوم}' },
          { key: 'menu', role: 'band', title: 'المنيو ]', nav: 'المنيو' },
        ],
        briefs: [
          { key: 'hero', purpose: 'قل "من نحن" وادعُ {للطلب} ]]', mustSay: ['\\"مشوي\\"'] },
          { key: 'menu', purpose: 'الأطباق والأسعار }{', facts: [{ key: 'price', sample: '٣٫٥ د.أ' }] },
        ],
      },
    };
    const text = JSON.stringify(tricky, null, 2);
    for (const events of [createPlanStreamReader().push(text), feed(text, () => 1)]) {
      expect(events.map(({ kind }) => kind)).toEqual(['head', 'brief', 'brief']);
      const [head, hero, menu] = events;
      expect(head?.kind === 'head' ? head.rationale : undefined).toBe(tricky.rationale);
      expect(head?.kind === 'head' ? head.candidate : undefined).toEqual(headOf(tricky.pagePlan));
      expect(hero?.kind === 'brief' ? hero.brief : undefined).toEqual(tricky.pagePlan.briefs[0]);
      expect(menu?.kind === 'brief' ? menu.brief : undefined).toEqual(tricky.pagePlan.briefs[1]);
    }
  });

  it('reads a bare plan with no pagePlan wrapper, keeping the wrapper keys out of the candidate', () => {
    const bare = { version: 1, rationale: PARSED.rationale, ...PARSED.pagePlan };
    const events = createPlanStreamReader().push(JSON.stringify(bare));
    expectExampleEvents(events);
    const head = events[0];
    expect(head?.kind === 'head' ? Object.keys(head.candidate) : []).not.toContain('version');
    expect(head?.kind === 'head' ? Object.keys(head.candidate) : []).not.toContain('rationale');
  });

  it('skips a brief whose slice does not parse, and still gives the ones after it', () => {
    const text = `{"pagePlan":{"intent":"new-page","sections":[{"key":"hero","role":"hero","title":"Hi"}],
      "briefs":[{"key":"hero","purpose": oops},{"key":"menu","purpose":"Prices",},{"key":"order","purpose":"Order"}]}}`;
    for (const events of [createPlanStreamReader().push(text), feed(text, () => 1)]) {
      expect(events.map((event) => (event.kind === 'brief' ? event.index : event.kind))).toEqual([
        'head',
        2,
      ]);
      const last = events[1];
      expect(last?.kind === 'brief' ? last.brief : undefined).toEqual({ key: 'order', purpose: 'Order' });
    }
  });

  it('gives nothing for a head whose slice does not parse, and still gives the briefs', () => {
    const text = `{"pagePlan":{"intent": new,"sections":[{"key":"hero"}],"briefs":[{"key":"hero","purpose":"Hi"}]}}`;
    const events = createPlanStreamReader().push(text);
    expect(events).toEqual([{ kind: 'brief', index: 0, brief: { key: 'hero', purpose: 'Hi' } }]);
  });

  it('forgets everything on reset: a new response reads from scratch', () => {
    const reader = createPlanStreamReader();
    const half = reader.push(EXAMPLE.slice(0, EXAMPLE.indexOf('"briefs"') + 30));
    expect(half.map(({ kind }) => kind)).toEqual(['head']);
    reader.reset();
    // The rest of the first response is gone; the second is read whole, head included.
    expectExampleEvents(reader.push(`\`\`\`json\n${EXAMPLE}`));
    // A finished reader reads nothing more until it is reset.
    expect(reader.push(EXAMPLE)).toEqual([]);
    reader.reset();
    expectExampleEvents(reader.push(EXAMPLE));
  });

  it('gives only the head for the classic shape, which has no briefs', () => {
    const classic = {
      version: 1,
      rationale: 'Classic.',
      pagePlan: {
        intent: 'new-page',
        locale: { lang: 'en' },
        title: 'Classic',
        description: 'A classic plan.',
        tokens: { bg: 'white' },
        primaryCta: { label: 'Go', href: '#hero' },
        nav: [{ label: 'Hero', anchorId: 'hero' }],
        sections: [
          { key: 'hero', role: 'hero', title: 'Hi', anchorId: 'hero', purpose: 'Greet.' },
          { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Contact.' },
        ],
        facts: [{ key: 'phone', sample: '+44 113 496 0000', section: 'footer' }],
      },
    };
    const events = feed(JSON.stringify(classic, null, 2), () => 5);
    expect(events).toEqual([
      { kind: 'head', rationale: 'Classic.', candidate: headOf(classic.pagePlan) },
    ]);
  });

  it('reads a 50,000-character answer pushed one character at a time in linear time', () => {
    const briefs = Array.from({ length: 40 }, (_unused, index) => ({
      key: `section-${String(index)}`,
      purpose: 'Words with "quotes", {braces} and [brackets]. '.repeat(26),
    }));
    const big = JSON.stringify({
      version: 1,
      rationale: 'Big.',
      pagePlan: {
        intent: 'new-page',
        sections: briefs.map(({ key }) => ({ key, role: 'band', title: key })),
        briefs,
      },
    });
    expect(big.length).toBeGreaterThan(50_000);
    const reader = createPlanStreamReader();
    const started = performance.now();
    let count = 0;
    for (const character of big) count += reader.push(character).length;
    const elapsed = performance.now() - started;
    expect(count).toBe(41);
    // Loose: a quadratic reader takes seconds here; a linear one, a few milliseconds.
    expect(elapsed).toBeLessThan(1_500);
  });
});
