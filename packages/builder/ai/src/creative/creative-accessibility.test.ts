import { describe, expect, it } from 'vitest';

import { planCreativeBrief, renderCreativeBrief } from './creative-planner';

/*
  The owner (2026-10-14): every mural shipped an explanation card with Next / Restart buttons
  nobody asked for. A mural's brief now asks for none; a game or a story keeps its controls.
*/
describe('creative brief — a mural carries no controls of its own', () => {
  it.each([
    ['اعمل جدارية لغابة في الليل', 'ar'],
    ['A layered mural of a city at night', 'en'],
  ])('briefs %s without controls, dialogue or navigation', (request) => {
    const brief = planCreativeBrief(request);
    expect(brief.kind).toBe('scene');
    const text = renderCreativeBrief(brief);
    expect(text).not.toMatch(
      /dialogue choices|dialogue view|keyboard and touch controls|manual navigation|its buttons/u,
    );
    expect(text).not.toMatch(/الحوار|التحكم ونص القصة|تنقل يدوي/u);
    expect(brief.accessibility.join(' ')).toMatch(/unless the person asked|إلا إذا طلبها/u);
  });

  it('keeps a mural that tells a story a mural, not a chapter story with a dialogue box', () => {
    for (const request of [
      'جدارية تحكي قصة ليلى في الصحراء',
      'A mural telling the story of a fox',
    ]) {
      const brief = planCreativeBrief(request);
      expect(brief.genre, request).toBe('mural');
      expect(brief.libs, request).not.toContain('dialogue');
    }
  });

  it('leaves games and stories their controls and text in the DOM', () => {
    for (const request of ['اعمل قصة تفاعلية عن ليلى', 'Make a game where you collect stars']) {
      const brief = planCreativeBrief(request);
      expect(brief.kind, request).not.toBe('scene');
      expect(brief.accessibility.join(' '), request).toMatch(/controls|التحكم/u);
    }
  });
});
