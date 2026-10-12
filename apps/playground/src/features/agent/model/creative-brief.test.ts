/**
 * The record's creative brief (creative agent, 2026-10-12): the same deterministic plan the
 * section writers read, reduced to what CreativeBriefCard draws, and cached per request.
 */
import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry, pixiSkillIdsFor } from '@craftkit/builder';

import { t } from '../copy';

import { creativeBriefView } from './creative-brief';
import type { Locale } from './view-types';

const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];
const REGISTRY = createCraftkitAiSkillRegistry();

describe('creativeBriefView', () => {
  it('plans each creative starter as the genre its card promises, in both locales', () => {
    for (const locale of LOCALES) {
      expect(creativeBriefView(t(locale, 'creative.game.prompt')).genre, locale).toBe('platformer');
      expect(creativeBriefView(t(locale, 'creative.story.prompt')).genre, locale).toBe(
        'visual-novel',
      );
      expect(creativeBriefView(t(locale, 'creative.bedtime.prompt')).genre, locale).toBe(
        'picture-book',
      );
    }
  });

  it('marks every starter as a creative build: the Pixi playbooks match it', () => {
    for (const locale of LOCALES) {
      for (const starter of ['game', 'story', 'bedtime'] as const) {
        const prompt = t(locale, `creative.${starter}.prompt`);
        expect(pixiSkillIdsFor(REGISTRY, prompt).length, `${locale} ${starter}`).toBeGreaterThan(0);
      }
    }
  });

  it('names the libraries and effects as API ids, at most six effects', () => {
    const brief = creativeBriefView(t('en', 'creative.game.prompt'));
    expect(brief.libs).toEqual(expect.arrayContaining(['tilemap', 'anim', 'fx']));
    expect(brief.effects.length).toBeGreaterThan(0);
    expect(brief.effects.length).toBeLessThanOrEqual(6);
    for (const id of [...brief.libs, ...brief.effects]) expect(id).toMatch(/^[a-z][a-z-]*$/u);
  });

  it('returns the same view for the same request: a live record re-renders without re-planning', () => {
    const request = t('ar', 'creative.game.prompt');
    expect(creativeBriefView(request)).toBe(creativeBriefView(request));
  });
});
