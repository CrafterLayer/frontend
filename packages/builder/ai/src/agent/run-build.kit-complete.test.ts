import { describe, expect, it, vi } from 'vitest';

import { checkKitSlots } from '../section-kit';
import { AGENT_TOOL_COMMAND } from '../tools/agent/types';
import type { AiPlan } from '../types';
import { pagePhotoPlan } from './page-plan/kit-slots';
import { planKit } from './page-plan/kits';
import { validatePagePlan, type PagePlan } from './page-plan';
import { completeKitSteps } from './run-build';

/*
  A kit writer's answer completed before the door sees it (quality pass
  2026-10-05). measure-v2: every run spent a whole writer repair round on
  `kit "features-bento" needs slot "caption"`, and the hero and the features
  band showed the same stock photo.
*/

function plan(): PagePlan {
  const result = validatePagePlan({
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'مشاوي عمّان — مطعم مشاوي',
    description: 'مطعم مشاوي في عمّان.',
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'red-700',
      onAccent: 'white',
      border: '#e7e5e4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'flames',
    },
    primaryCta: { label: 'احجز طاولة', href: '#dishes' },
    sections: [
      { key: 'hero', role: 'hero', title: 'مشاوي طازة', anchorId: 'hero', purpose: 'ما هو المطعم.', kit: 'hero-overlay', images: [{ subject: 'restaurant', aspect: 'landscape', alt: 'طاولة' }] },
      { key: 'dishes', role: 'band', title: 'أطباقنا', anchorId: 'dishes', purpose: 'الأطباق.', mustSay: ['لحم بلدي طازج'], kit: 'features-bento', images: [{ subject: 'restaurant', aspect: 'landscape', alt: 'أطباق' }] },
    ],
    facts: [],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}

function answer(slots: Record<string, unknown>): AiPlan {
  return {
    rationale: 'kit',
    commands: [
      { command: AGENT_TOOL_COMMAND, args: { name: 'kit.section', input: { id: 'r-2', kit: 'features-bento', slots } } },
    ],
  };
}

function slotsOf(plan: AiPlan): Record<string, unknown> {
  const args = plan.commands[0]?.args as { input: { slots: Record<string, unknown> } };
  return args.input.slots;
}

/*
  A whole build per test: under a full parallel run these outlive vitest's 5s
  default (they pass in ~10s per file alone). The budget only bounds a hang.
*/
vi.setConfig({ testTimeout: 20_000 });

describe('completeKitSteps', () => {
  it("fills the caption the writer left out and gives the image the section's own photo", () => {
    const page = plan();
    const dishes = page.sections[1];
    if (dishes === undefined) throw new Error('no section');
    const written = answer({
      title: 'أطباقنا',
      image: { subject: 'restaurant', alt: 'أطباق' },
      items: [{ icon: 'flame', title: 'مشاوي', text: 'على الفحم.' }],
    });
    const completed = completeKitSteps(page, dishes, written);
    const slots = slotsOf(completed);
    expect(slots['caption']).toBe('لحم بلدي طازج');
    const src = (slots['image'] as { src: string }).src;
    expect(src).toBe(pagePhotoPlan(page).bySection.get('dishes')?.[0]?.url);
    expect(src).not.toBe(pagePhotoPlan(page).bySection.get('hero')?.[0]?.url);
    const bento = planKit('features-bento');
    expect(bento !== undefined && checkKitSlots(bento, slots).ok).toBe(true);
    // The written answer is not mutated.
    expect(slotsOf(written)).not.toHaveProperty('caption');
  });

  it('returns a markup answer (no kit step) as written', () => {
    const page = plan();
    const dishes = page.sections[1];
    if (dishes === undefined) throw new Error('no section');
    const markup: AiPlan = { rationale: 'm', commands: [{ command: 'setProp', args: { id: 'r-2', key: 'tree', value: {} } }] };
    expect(completeKitSteps(page, dishes, markup)).toBe(markup);
  });
});
