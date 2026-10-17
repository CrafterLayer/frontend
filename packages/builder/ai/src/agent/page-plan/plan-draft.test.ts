import { describe, expect, it } from 'vitest';

import {
  briefArrived,
  provisionalCandidate,
  reconcilePlans,
  sectionFingerprint,
  startPlanDraft,
  withBrief,
} from './plan-draft';
import { validatePagePlan } from './validate-page-plan';
import type { PagePlan } from './types';

/*
  The streamed plan's draft state (DESIGN §5.4): what the reader delivered,
  the provisional candidate built from it, and the reconciliation that
  decides which speculative work survives the final plan.
*/

const OUTLINE = [
  { key: 'header', role: 'header', title: 'Header' },
  { key: 'hero', role: 'hero', title: 'Roasted this morning', variant: 'split' },
  { key: 'menu', role: 'band', title: 'Menu', nav: 'Menu' },
  { key: 'footer', role: 'footer', title: 'Footer' },
];

function draftOf() {
  return startPlanDraft({
    kind: 'head',
    rationale: 'Warm.',
    candidate: { intent: 'new-page', title: 'Cardamom', sections: OUTLINE },
  });
}

describe('plan draft — the outline and the briefs received so far', () => {
  it('starts from the head and records each brief by key, immutably', () => {
    const draft = draftOf();
    expect(draft.rationale).toBe('Warm.');
    expect(draft.briefs.size).toBe(0);
    const next = withBrief(draft, { key: 'menu', purpose: 'Prices.' });
    expect(next.briefs.get('menu')).toEqual({ key: 'menu', purpose: 'Prices.' });
    expect(draft.briefs.size).toBe(0);
    // A brief without a key changes nothing.
    expect(withBrief(next, { purpose: 'Lost.' })).toBe(next);
  });

  it('says a brief arrived only for its own key, and never for a classic section', () => {
    const draft = withBrief(draftOf(), { key: 'hero', purpose: 'Say it.' });
    expect(briefArrived(draft, 'hero')).toBe(true);
    expect(briefArrived(draft, 'menu')).toBe(false);
    const classic = withBrief(
      startPlanDraft({
        kind: 'head',
        candidate: {
          sections: [{ key: 'hero', role: 'hero', title: 'Hi', anchorId: 'hero', purpose: 'Greet.' }],
        },
      }),
      { key: 'hero', purpose: 'Late.' },
    );
    expect(briefArrived(classic, 'hero')).toBe(false);
  });

  it('builds the provisional candidate: the head plus the received briefs in outline order', () => {
    const draft = withBrief(
      withBrief(withBrief(draftOf(), { key: 'footer', purpose: 'Contact.' }), {
        key: 'hero',
        purpose: 'Say it.',
      }),
      { key: 'ghost', purpose: 'No such section.' },
    );
    expect(provisionalCandidate(draft)).toEqual({
      intent: 'new-page',
      title: 'Cardamom',
      sections: OUTLINE,
      briefs: [
        { key: 'hero', purpose: 'Say it.' },
        { key: 'footer', purpose: 'Contact.' },
      ],
    });
    // No brief yet: the head alone, so a classic head reads exactly as the classic shape.
    expect(provisionalCandidate(draftOf())).toEqual({
      intent: 'new-page',
      title: 'Cardamom',
      sections: OUTLINE,
    });
  });
});

// ── reconciliation, on classic plans the validator accepts ───────────────────

function base(): Record<string, unknown> {
  return {
    intent: 'new-page',
    locale: { lang: 'en' },
    title: 'Northlight Studio | Brand design',
    description: 'A two-person brand studio in Leeds.',
    tokens: {
      bg: 'zinc-950',
      surface: 'zinc-900',
      ink: 'zinc-50',
      muted: 'zinc-400',
      accent: 'amber-400',
      onAccent: 'zinc-950',
      border: 'zinc-600',
      fontDisplay: { family: 'Archivo Black' },
      fontBody: { family: 'Archivo', weights: [400, 600] },
      radius: 'full',
      signature: 'one oversized numeral per section',
    },
    primaryCta: { label: 'Book a call', href: '#contact' },
    nav: [
      { label: 'Work', anchorId: 'work' },
      { label: 'Contact', anchorId: 'contact' },
    ],
    sections: [
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Nav.' },
      { key: 'hero', role: 'hero', title: 'Brands that hold', anchorId: 'hero', purpose: 'Pitch.' },
      { key: 'work', role: 'band', title: 'Selected work', anchorId: 'work', purpose: 'Proof.' },
      { key: 'about', role: 'band', title: 'About us', anchorId: 'about', purpose: 'Who.' },
      { key: 'contact', role: 'cta', title: 'Talk to us', anchorId: 'contact', purpose: 'Book.' },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Contact.' },
    ],
    facts: [{ key: 'email', sample: 'hello@northlight.studio', section: 'footer' }],
  };
}

function accepted(value: Record<string, unknown>): PagePlan {
  const result = validatePagePlan(value);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  return result.plan;
}

type Section = Record<string, unknown>;

function withSections(edit: (sections: Section[]) => Section[]): Record<string, unknown> {
  const value = base();
  return { ...value, sections: edit(structuredClone(value['sections']) as Section[]) };
}

/** The same data with every object's keys in reverse order. */
function reordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reordered);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, member]) => [key, reordered(member)]),
  );
}

describe('sectionFingerprint — what a writer reads, as stable text', () => {
  it('is the same for the same data whatever the key order, and undefined for an absent key', () => {
    const plan = accepted(base());
    const shuffled = reordered(plan) as PagePlan;
    expect(JSON.stringify(shuffled)).not.toBe(JSON.stringify(plan));
    for (const { key } of plan.sections) {
      expect(sectionFingerprint(shuffled, key)).toBe(sectionFingerprint(plan, key));
    }
    expect(sectionFingerprint(plan, 'nowhere')).toBeUndefined();
  });

  it('differs between sections, and carries the nav only for the header and footer', () => {
    const plan = accepted(base());
    const prints = plan.sections.map(({ key }) => sectionFingerprint(plan, key));
    expect(new Set(prints).size).toBe(plan.sections.length);
    const renamedNav = accepted({ ...base(), nav: [{ label: 'Our work', anchorId: 'work' }] });
    expect(sectionFingerprint(renamedNav, 'header')).not.toBe(sectionFingerprint(plan, 'header'));
    expect(sectionFingerprint(renamedNav, 'footer')).not.toBe(sectionFingerprint(plan, 'footer'));
    expect(sectionFingerprint(renamedNav, 'work')).toBe(sectionFingerprint(plan, 'work'));
  });
});

describe('reconcilePlans — provisional against final', () => {
  it('finds nothing to redo when the final plan is the provisional one', () => {
    const plan = accepted(base());
    expect(reconcilePlans(plan, accepted(base()))).toEqual({
      sameOutline: true,
      headChanged: false,
      changedKeys: [],
    });
  });

  it('names only the section whose contract changed', () => {
    const final = accepted(
      withSections((sections) =>
        sections.map((section) =>
          section['key'] === 'work' ? { ...section, purpose: 'Three case studies.' } : section,
        ),
      ),
    );
    expect(reconcilePlans(accepted(base()), final)).toEqual({
      sameOutline: true,
      headChanged: false,
      changedKeys: ['work'],
    });
  });

  it('names the section a fact moved to and from', () => {
    const final = accepted({
      ...base(),
      facts: [{ key: 'email', sample: 'hello@northlight.studio', section: 'contact' }],
    });
    const result = reconcilePlans(accepted(base()), final);
    expect(result.sameOutline).toBe(true);
    expect(result.changedKeys).toEqual(['contact', 'footer']);
  });

  it('calls a renamed section a different outline', () => {
    const final = accepted(
      withSections((sections) =>
        sections.map((section) =>
          section['key'] === 'about' ? { ...section, title: 'The studio' } : section,
        ),
      ),
    );
    const result = reconcilePlans(accepted(base()), final);
    expect(result.sameOutline).toBe(false);
    expect(result.changedKeys).toContain('about');
  });

  it('calls reordered sections a different outline', () => {
    const final = accepted(
      withSections((sections) => {
        const [header, hero, work, about, ...rest] = sections;
        return [header!, hero!, about!, work!, ...rest];
      }),
    );
    expect(reconcilePlans(accepted(base()), final).sameOutline).toBe(false);
  });

  it('calls a different intent a different outline', () => {
    const final = accepted({ ...base(), intent: 'replace' });
    expect(reconcilePlans(accepted(base()), final).sameOutline).toBe(false);
  });

  it('marks the head changed and every section changed when the tokens change', () => {
    const value = base();
    const final = accepted({
      ...value,
      tokens: { ...(value['tokens'] as Record<string, unknown>), accent: '#a3e635' },
    });
    const provisional = accepted(base());
    const result = reconcilePlans(provisional, final);
    expect(result.sameOutline).toBe(true);
    expect(result.headChanged).toBe(true);
    expect(result.changedKeys).toEqual(provisional.sections.map(({ key }) => key));
  });

  it('marks the head changed when only the description changes, without touching a band', () => {
    const final = accepted({ ...base(), description: 'A brand studio in Leeds since 2014.' });
    const result = reconcilePlans(accepted(base()), final);
    expect(result.headChanged).toBe(true);
    expect(result.changedKeys).toEqual([]);
  });
});
