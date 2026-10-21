import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../builtins';
import { resolveAiCommandPolicy } from '../command-policy';
import { DESIGN_QUALITY_TEACHING } from '../design-libraries';
import { requestSkillIdsFor } from '../request-skills';
import { CRAFTKIT_DEFAULT_SKILLS } from './index';

const registry = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS);

function automatic(request: string, id: string): string {
  const skill = registry.prepare({ request }).active.find((active) => active.id === id);
  expect(skill, `Expected ${id} to reach this request`).toBeDefined();
  return skill?.instructions ?? '';
}

describe('task-led screen guidance delivered by the registry', () => {
  it.each([
    'Improve the mobile navigation of this dense editor',
    'حسن الأزرار للجوال في لوحة التحكم',
  ])('keeps purposeful phone grids and data scrolling available: %s', (request) => {
    const instructions = automatic(request, 'craftkit.pro-max-ux');
    expect(instructions).toContain('Purposeful phone grids');
    expect(instructions).toContain('labelled, keyboard-usable region');
    expect(instructions).toContain('focus outline');
    expect(instructions).toContain('aria-label');
    expect(instructions).toContain('reduced motion');
    expect(instructions).not.toMatch(
      /one container width|columns stack below md|one or two moving things|transform and opacity only/u,
    );
  });

  it.each([
    'Change the fonts and colors of this analytical workspace',
    'غير ألوان الموقع وخطوط لوحة التحكم',
  ])('keeps optional typography and semantic accents without a preset: %s', (request) => {
    const instructions = automatic(request, 'craftkit.type-colour');
    expect(instructions).toContain('multiple semantic accents are valid');
    expect(instructions).toContain('Optional pairing references');
    expect(instructions).toContain('verified, loaded with shipped weights');
    expect(instructions).toContain("cover their text's script");
    expect(instructions).toContain('4.5:1');
    expect(instructions).toContain('3:1');
    expect(instructions).toContain('Arabic needs readable line height');
    expect(instructions).not.toMatch(
      /Two families at most|one accent and neutrals|60%|MOODS TO HUES|headings step clearly/u,
    );
  });

  it('passes flexible geometry through a bespoke header writer without changing its commands', () => {
    const skills = registry.prepare({
      request: '',
      auto: false,
      selectedSkillIds: [
        'craftkit.build-fill',
        ...requestSkillIdsFor(registry, 'Create a task-focused editor', 'section', {
          role: 'header',
          composition: 'bespoke',
          contractText: 'Compact product navigation with search and workspace actions',
        }),
      ],
    });
    const fill = skills.active.find(({ id }) => id === 'craftkit.build-fill');
    const ux = skills.active.find(({ id }) => id === 'craftkit.pro-max-ux');
    expect(fill?.instructions).toContain(DESIGN_QUALITY_TEACHING);
    expect(ux?.instructions).toContain('Purposeful phone grids');
    expect(fill?.instructions).not.toMatch(
      /cards w-full|Collapse multi-column layouts|One visual signature/u,
    );
    expect(fill?.instructions).toContain('no other node or page-level change');
    expect(DESIGN_QUALITY_TEACHING.length).toBeLessThan(700);
    expect(
      resolveAiCommandPolicy({
        registeredCommands: ['setProp', 'insertNode', 'removeNode', 'applySitePatches'],
        skills,
        session: { allowedCommands: ['setProp'], maxCommands: 4 },
      }),
    ).toMatchObject({ allowedCommands: ['setProp'], maxCommands: 4 });
  });

  it('does not turn internal forms into sales or contact screens', () => {
    const instructions = automatic(
      'Improve the form for an internal expense approval workflow',
      'craftkit.forms-convert',
    );
    expect(instructions).toContain('when it serves this form');
    expect(instructions).toContain('visible label');
    expect(instructions).toContain('aria-describedby');
    expect(instructions).toContain('keep what the person typed');
    expect(instructions).toContain('Do not claim delivery or persistence without an integration');
    expect(instructions).not.toContain('beside a contact form offer a direct path');
  });

  it('keeps truthful evidence without forcing a report FAQ or closing sales action', () => {
    const instructions = automatic(
      'Review the trust and results in this report',
      'craftkit.trust-proof',
    );
    expect(instructions).toContain(
      'an FAQ, its question count and a closing sales action are optional',
    );
    expect(instructions).toContain('never invent');
    expect(instructions).toContain('only as given');
    expect(instructions).not.toContain('an FAQ answering the three questions');
  });

  it('keeps natural copy useful without a headline word quota', () => {
    const instructions = automatic(
      'Rewrite this report headline in Arabic',
      'craftkit.natural-copy',
    );
    expect(instructions).toContain('without a fixed word count');
    expect(instructions).toContain('keep numbers, prices, phones and links identical');
    expect(instructions).not.toContain('headlines of eight words or fewer');
  });
});
