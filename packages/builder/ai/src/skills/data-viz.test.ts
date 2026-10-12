import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from './builtins';
import { DATA_VIZ_SKILL } from './data-viz';

function active(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry()
    .prepare({ request })
    .active.map(({ id }) => id);
}

describe('craftkit.data-viz', () => {
  it.each([
    'Add a chart of our monthly bookings',
    'Show these statistics on the about page',
    'Turn this CSV into a dashboard section',
    'اعرض هذه البيانات في مخطط',
    'أضف رسم بياني للمبيعات',
    'ضع الإحصائيات في جدول',
    'Make a dashboard from these sales figures',
    'Draw a sales funnel',
    'اعمل تقرير من هذه البيانات',
    'أضف قمع المبيعات',
  ])('activates on %s', (request) => {
    expect(active(request)).toContain('craftkit.data-viz');
  });

  it('stays out of a café page that books a table', () => {
    expect(active('Make the hero warmer and add a Book a table button')).not.toContain('craftkit.data-viz');
  });

  it('teaches the tools, the added chart types and the honesty rule', () => {
    expect(DATA_VIZ_SKILL.instructions).toContain('"name":"data.show"');
    expect(DATA_VIZ_SKILL.instructions).toContain('"name":"report.build"');
    for (const type of ['hbar', 'combo', 'scatter', 'radar', 'funnel', 'gauge', 'sparkline']) {
      expect(DATA_VIZ_SKILL.instructions).toContain(type);
    }
    expect(DATA_VIZ_SKILL.instructions).toContain('never present invented statistics as real');
  });
});
