import { describe, expect, it } from 'vitest';

import { utilityVocabulary } from '@craftkit/builder-schema';

import { agentTool } from '../../tools/agent/registry';
import { CRAFTKIT_AI_SKILL_DEFINITIONS, createCraftkitAiSkillRegistry } from '../builtins';
import { VERIFIED_FONT_FAMILIES } from '../verified-fonts';
import { CRAFTKIT_DEFAULT_SKILLS, DESIGN_ROWS, LANDING_PATTERNS, TYPE_MOODS } from './index';

/** What a person's skill editor accepts, so "Make it my own" can open any default. */
const EDITOR_MAX_INSTRUCTIONS = 6_000;

function active(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS)
    .prepare({ request })
    .active.map(({ id }) => id);
}

describe('CRAFTKIT_DEFAULT_SKILLS', () => {
  it('is seven reviewed skills the registry accepts beside every built-in', () => {
    const ids = CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id);
    expect(ids).toEqual([
      'craftkit.pro-max-design',
      'craftkit.pro-max-landing',
      'craftkit.pro-max-ux',
      'craftkit.type-colour',
      'craftkit.forms-convert',
      'craftkit.arabic-copy',
      'craftkit.trust-proof',
    ]);
    const builtIns = new Set(CRAFTKIT_AI_SKILL_DEFINITIONS.map(({ id }) => id));
    expect(ids.filter((id) => builtIns.has(id))).toEqual([]);
    const registry = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS);
    expect(registry.list()).toHaveLength(CRAFTKIT_AI_SKILL_DEFINITIONS.length + ids.length);
  });

  it('ranks below every word-triggered built-in, so a tight budget keeps the engine’s own first', () => {
    const lowestBuiltIn = Math.min(
      ...CRAFTKIT_AI_SKILL_DEFINITIONS.filter(({ activation }) => activation?.mode === 'auto').map(
        ({ priority }) => priority ?? 0,
      ),
    );
    for (const skill of CRAFTKIT_DEFAULT_SKILLS) {
      expect({ id: skill.id, below: (skill.priority ?? 0) <= lowestBuiltIn }).toEqual({
        id: skill.id,
        below: true,
      });
      expect(skill.activation?.mode).toBe('auto');
    }
  });

  it('keeps each one small enough to open in the skill editor', () => {
    for (const skill of CRAFTKIT_DEFAULT_SKILLS) {
      expect({ id: skill.id, fits: skill.instructions.length <= EDITOR_MAX_INSTRUCTIONS }).toEqual({
        id: skill.id,
        fits: true,
      });
    }
  });

  it('names only verified font families, and Arabic ones for Arabic pages', () => {
    for (const mood of TYPE_MOODS) {
      for (const family of [mood.display, mood.body, mood.arabicDisplay, mood.arabicBody]) {
        expect({ family, verified: VERIFIED_FONT_FAMILIES[family] !== undefined }).toEqual({
          family,
          verified: true,
        });
      }
      expect(VERIFIED_FONT_FAMILIES[mood.arabicDisplay]?.arabic).toBe(true);
      expect(VERIFIED_FONT_FAMILIES[mood.arabicBody]?.arabic).toBe(true);
    }
    for (const skill of CRAFTKIT_DEFAULT_SKILLS)
      expect(skill.instructions).not.toContain('Cairo, Tajawal');
  });

  it('gives every kind of business real colours and a known type mood', () => {
    const moods = new Set(TYPE_MOODS.map(({ mood }) => mood));
    expect(DESIGN_ROWS.length).toBeGreaterThanOrEqual(25);
    for (const row of DESIGN_ROWS) {
      expect(row.accent).toMatch(/^#[0-9A-F]{6}$/u);
      expect(row.ground).toMatch(/^#[0-9A-F]{6}$/u);
      expect(moods.has(row.type)).toBe(true);
    }
    expect(LANDING_PATTERNS.length).toBeGreaterThanOrEqual(12);
  });

  it('teaches only tools the agent has', () => {
    const named = new Set(
      CRAFTKIT_DEFAULT_SKILLS.flatMap(
        ({ instructions }) => instructions.match(/\b[a-z]+\.[a-z]+(?= \{)/gu) ?? [],
      ),
    );
    expect([...named].sort()).toEqual(['fonts.set', 'theme.apply']);
    for (const name of named) expect(agentTool(name)).toBeDefined();
  });

  it('names only utilities the door admits', () => {
    const vocabulary = utilityVocabulary();
    const CLASS =
      /^(sm:|md:|lg:|hover:)?(text|bg|h|w|leading|cursor|break|grid|flex|gap|p|px|py|m|rounded|shadow)-[a-z0-9-]+$/u;
    const unknown = CRAFTKIT_DEFAULT_SKILLS.flatMap(({ instructions }) =>
      instructions
        .split(/[\s"'`(),;{}]+/u)
        .map((token) => token.replace(/[.:,;]+$/u, ''))
        .filter((token) => CLASS.test(token) && !vocabulary.has(token)),
    );
    expect(unknown).toEqual([]);
  });
});

describe('default skill activation', () => {
  it.each([
    [
      'Build a landing page for my dental clinic',
      ['craftkit.pro-max-design', 'craftkit.pro-max-landing'],
    ],
    ['صمم لي موقع لمطعم في الرياض', ['craftkit.pro-max-design', 'craftkit.arabic-copy']],
    ['Add a contact form under the hero', ['craftkit.forms-convert']],
    ['أضف نموذج حجز', ['craftkit.forms-convert', 'craftkit.arabic-copy']],
    ['Change the fonts to something elegant', ['craftkit.type-colour']],
    ['غير ألوان الموقع', ['craftkit.type-colour']],
    ['Add testimonials from our clients', ['craftkit.trust-proof']],
    ['Make the buttons bigger on mobile', ['craftkit.pro-max-ux']],
  ])('«%s» turns on %j', (request, expected) => {
    expect(active(request)).toEqual(expect.arrayContaining(expected));
  });

  it.each(['Make the headline shorter', 'Translate the hero to French', 'Undo that'])(
    '«%s» turns none of them on',
    (request) => {
      const defaults = new Set(CRAFTKIT_DEFAULT_SKILLS.map(({ id }) => id));
      expect(active(request).filter((id) => defaults.has(id))).toEqual([]);
    },
  );

  it('fits beside the built-ins on a request that matches nearly all of them', () => {
    const prepared = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS).prepare({
      request:
        'صمم موقع هبوط لعيادة مع نموذج حجز وآراء العملاء وألوان وخطوط جديدة وأزرار للجوال landing page design form testimonials fonts mobile',
    });
    expect(prepared.active.length).toBeGreaterThan(5);
  });
});
