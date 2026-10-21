import { describe, expect, it } from 'vitest';
import fonts from 'open-props/src/fonts';
import sizes from 'open-props/src/sizes';
import { findCssRejection } from '@craftkit/builder-schema';
import { DESIGN_MATERIAL_TEACHING } from './design-material';
import {
  DESIGN_QUALITY_TEACHING,
  DESIGN_MATERIAL_TEACHING as PUBLIC_DESIGN_MATERIAL,
} from './design-libraries';
import { AUTHORED_DESIGN_TEACHING } from './authored-design';
import { createCraftkitAiSkillRegistry } from './builtins';
import { planningRequest } from '../agent/page-plan-context';

describe('installed design material reaches real generation contracts', () => {
  it('uses actual self-contained library values accepted by the region CSS policy', () => {
    for (const [name, value] of [
      ['size-fluid-2', sizes['--size-fluid-2']],
      ['font-size-fluid-2', fonts['--font-size-fluid-2']],
    ])
      expect(DESIGN_MATERIAL_TEACHING).toContain('--' + String(name) + ':' + String(value));
    expect(
      findCssRejection(
        '.ck-data{gap:' +
          sizes['--size-fluid-2'] +
          ';font-size:' +
          fonts['--font-size-fluid-2'] +
          '}',
      ),
    ).toBeUndefined();
    expect(DESIGN_MATERIAL_TEACHING).not.toContain('var(');
    expect(DESIGN_MATERIAL_TEACHING).toContain('NOT installed');
    expect(DESIGN_MATERIAL_TEACHING.length).toBeLessThan(1_500);
  });

  it('reaches planning, region fill, ordinary edit and authored React within existing budgets', () => {
    const registry = createCraftkitAiSkillRegistry();
    expect(planningRequest('Build a report', 'replace')).toContain(DESIGN_MATERIAL_TEACHING);
    expect(registry.readSkill('craftkit.build-fill')).toContain(DESIGN_MATERIAL_TEACHING);
    expect(PUBLIC_DESIGN_MATERIAL).toBe(DESIGN_MATERIAL_TEACHING);
    expect(AUTHORED_DESIGN_TEACHING).toContain(DESIGN_MATERIAL_TEACHING);
    expect(AUTHORED_DESIGN_TEACHING.length).toBeLessThan(4_100);
    expect(DESIGN_QUALITY_TEACHING.length).toBeLessThan(700);
  });
});
