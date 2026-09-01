import { describe, expect, it } from 'vitest';

import { defineAiSkill } from './define-skill';
import { createAiSkillRegistry } from './registry';
import type { AiSkillDefinitionV1 } from './types';

/**
 * Activation by SCRIPT, not by phrase.
 *
 * The Arabic/RTL skill used to fire only when a request happened to contain a
 * listed imperative ("صمم لي"); "اعمل معرض أعمال" got no RTL expertise and
 * "صمم لي معرض أعمال" did — the same page, laid out differently by the verb.
 * A script trigger answers the question that was actually being asked: is
 * this request in Arabic?
 */
function skill(overrides: Partial<AiSkillDefinitionV1>): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'host.arabic',
    name: 'Arabic',
    description: 'RTL expertise.',
    version: '1.0.0',
    instructions: 'Lay the page out right-to-left.',
    trust: 'reviewed',
    activation: { mode: 'auto', scripts: ['arabic'] },
    ...overrides,
  };
}

describe('script-based activation', () => {
  it('activates on any Arabic request, whatever the verb', () => {
    const registry = createAiSkillRegistry([skill({})]);

    for (const request of ['اعمل معرض أعمال', 'صفحة هبوط لمتجر عطور', 'كبّر العنوان', 'Make the عنوان bigger']) {
      const prepared = registry.prepare({ request, auto: true });
      expect(prepared.active.map((active) => active.id), request).toEqual(['host.arabic']);
      expect(prepared.activations[0]?.reason).toBe('auto');
    }
  });

  it('stays silent on a request with no Arabic in it', () => {
    const registry = createAiSkillRegistry([skill({})]);

    expect(registry.prepare({ request: 'Make the heading bigger', auto: true }).active).toEqual([]);
    expect(registry.prepare({ request: '', auto: true }).active).toEqual([]);
  });

  it('recognises Arabic presentation forms and extended letters, not only the base block', () => {
    const registry = createAiSkillRegistry([skill({})]);

    // U+FEFB (ﻻ, a shaped form some editors paste) and U+06AF (گ, Persian).
    for (const request of ['title ﻻ', 'گفتگو']) {
      expect(registry.prepare({ request, auto: true }).active).toHaveLength(1);
    }
  });

  it('combines with keywords: either trigger activates', () => {
    const registry = createAiSkillRegistry([
      skill({ activation: { mode: 'auto', keywords: ['rtl'], scripts: ['arabic'] } }),
    ]);

    expect(registry.prepare({ request: 'make it rtl', auto: true }).active).toHaveLength(1);
    expect(registry.prepare({ request: 'عربي', auto: true }).active).toHaveLength(1);
  });

  it('is enough on its own — an auto activation no longer requires keywords', () => {
    expect(() => defineAiSkill(skill({}))).not.toThrow();
  });

  it('refuses a script the resolver cannot match', () => {
    expect(() =>
      defineAiSkill(skill({ activation: { mode: 'auto', scripts: ['klingon' as never] } })),
    ).toThrow(/activation\.scripts may name only arabic, latin/u);
  });

  it('canonicalises scripts: trimmed, lower-cased, sorted — and refuses a duplicate like keywords do', () => {
    const defined = defineAiSkill(
      skill({ activation: { mode: 'auto', scripts: ['Latin', ' arabic '] as never } }),
    );

    expect(defined.manifest.activation).toEqual({ mode: 'auto', scripts: ['arabic', 'latin'] });
    expect(() =>
      defineAiSkill(skill({ activation: { mode: 'auto', scripts: ['latin', 'Latin'] as never } })),
    ).toThrow(/duplicate value latin/u);
  });

  it('matches Latin script when asked to, for a host that wants English-only expertise', () => {
    const registry = createAiSkillRegistry([
      skill({ id: 'host.english', activation: { mode: 'auto', scripts: ['latin'] } }),
    ]);

    expect(registry.prepare({ request: 'Add a hero', auto: true }).active).toHaveLength(1);
    expect(registry.prepare({ request: 'أضف قسم', auto: true }).active).toHaveLength(0);
  });
});
