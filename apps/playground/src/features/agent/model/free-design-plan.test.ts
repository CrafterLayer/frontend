import { describe, expect, it } from 'vitest';
import { validatePagePlan } from '@craftkit/builder';
import { clinicPlan } from '../testing/page-plans';
import {
  applyPlanOp,
  canRemoveSection,
  draftFromEnginePagePlan,
  planProblems,
  toEnginePagePlan,
} from './page-plan-draft';

describe('authored design survives plan-card editing', () => {
  it('keeps a one-region design buildable and retains concept/layout/SEO during a title edit', () => {
    const base = clinicPlan();
    const hero = base.sections.find(({ role }) => role === 'hero');
    if (hero === undefined) throw new Error('missing fixture hero');
    const checked = validatePagePlan({
      ...base,
      design: {
        kind: 'website',
        composition: 'bespoke',
        chrome: 'none',
        concept: 'An asymmetric clinic journal with a narrow service index.',
      },
      sections: [{ ...hero, layout: 'Index beside the article; one column on a phone.' }],
      nav: [],
      facts: [],
      primaryCta: { label: 'Read', href: `#${hero.anchorId}` },
      seo: { keyword: 'clinic journal', pageKind: 'article', slug: 'clinic-journal' },
    });
    if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
    const draft = draftFromEnginePagePlan(checked.plan);
    expect(planProblems(draft)).toEqual([]);
    expect(canRemoveSection(draft)).toBe(false);
    const next = applyPlanOp(draft, { kind: 'rename', key: hero.key, title: 'Our journal' });
    const roundtrip = toEnginePagePlan(next);
    expect(roundtrip?.ok).toBe(true);
    if (roundtrip?.ok !== true) throw new Error('invalid roundtrip');
    expect(roundtrip.plan.design).toEqual(checked.plan.design);
    expect(roundtrip.plan.sections[0]?.layout).toBe(checked.plan.sections[0]?.layout);
    expect(roundtrip.plan.sections[0]?.title).toBe('Our journal');
    expect(roundtrip.plan.seo).toEqual(checked.plan.seo);
    expect(roundtrip.plan.sections[0]?.kit).toBeUndefined();
  });
});
