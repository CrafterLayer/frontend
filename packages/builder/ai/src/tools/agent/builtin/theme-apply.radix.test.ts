import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { applyAiPlan } from '../../../plan/apply-plan';
import { resolveAiCommandPolicy } from '../../../skills';
import { expandAndValidate, fixtureKernel, liveContext } from '../agent-tools.fixtures';
import { tryDirectTool } from '../direct-tool';
import { failingPairs, ratio, readPageKit } from '../page-kit';
import { RADIX_SCALES, type RadixAppearance } from './radix-palette';
import { themeApplyTool } from './theme-apply';

function paletteRun(scale: string, appearance: RadixAppearance, locale: 'en' | 'ar' = 'en') {
  const kernel = fixtureKernel({ locale });
  const before = kernel.getDocument();
  const beforeCss = before.nodes['root']?.props['pageCss'];
  const expanded = expandAndValidate(kernel, 'theme.apply', { radixScale: scale, appearance });
  expect(expanded.issues).toEqual([]);
  if (expanded.result?.ok !== true) throw new Error('expected a door-valid palette');
  expect(expanded.result.plan.commands).toHaveLength(1);
  const applied = applyAiPlan({
    kernel,
    plan: expanded.result.plan,
    policy: resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() }),
    validationPorts: { clock: fixedClock(2), ids: seededIds('radix-palette') },
  });
  expect(applied.mode).toBe('group');
  expect(applied.transactions).toHaveLength(1);
  const after = kernel.getDocument();
  const css = after.nodes['root']?.props['pageCss'];
  if (typeof css !== 'string' || typeof beforeCss !== 'string')
    throw new Error('expected page CSS');
  return {
    kernel,
    before,
    after,
    css,
    state: readPageKit(css, locale === 'ar').state,
    beforeState: readPageKit(beforeCss, locale === 'ar').state,
  };
}

describe('theme.apply Radix scales', () => {
  it.each(
    RADIX_SCALES.flatMap((scale) =>
      (['light', 'dark'] as const).map((appearance) => ({ scale, appearance })),
    ),
  )(
    '$scale $appearance passes the real door, every text pair, and one Undo',
    ({ scale, appearance }) => {
      const { kernel, before, after, state, beforeState } = paletteRun(scale, appearance);
      expect(failingPairs(state.colours)).toEqual([]);
      expect(state.display).toEqual(beforeState.display);
      expect(state.body).toEqual(beforeState.body);
      expect(state.radius).toBe(beforeState.radius);
      expect(after.dir).toBe(before.dir);
      for (const id of Object.keys(before.nodes)) {
        if (id !== 'root') expect(after.nodes[id]).toEqual(before.nodes[id]);
      }
      expect(kernel.undo()).toBe(true);
      expect(kernel.getDocument()).toEqual(before);
      expect(kernel.undo()).toBe(false);
    },
  );

  it('uses actual light/dark Radix values and dark text on the bright amber fill', () => {
    const light = paletteRun('amber', 'light').state.colours;
    const dark = paletteRun('amber', 'dark').state.colours;
    expect(light.bg).toBe('#fefdfb');
    expect(light.surface).toBe('#fefbe9');
    expect(light.accent).toBe('#ffc53d');
    expect(dark.bg).toBe('#16120c');
    expect(dark.accent).toBe('#ffc53d');
    expect(light.onAccent).toBe('#000000');
    expect(dark.onAccent).toBe('#000000');
    expect(ratio(light.onAccent, light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(dark.onAccent, dark.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('preserves Arabic faces and direction; repeated values are a no-op', () => {
    const { kernel, state, beforeState } = paletteRun('teal', 'dark', 'ar');
    expect(kernel.getDocument().dir).toBe('rtl');
    expect(state.display).toEqual(beforeState.display);
    expect(state.body).toEqual(beforeState.body);
    expect(
      themeApplyTool.run({ radixScale: 'teal', appearance: 'dark' }, liveContext(kernel)),
    ).toMatchObject({ ok: true, steps: [] });
  });

  it('defaults a scale to light and lets explicit brand colors override it', () => {
    const kernel = fixtureKernel();
    const run = themeApplyTool.run(
      { radixScale: 'blue', accent: '#b91c1c', bg: '#ffffff', ink: '#000000', surface: '#f5f5f5' },
      liveContext(kernel),
    );
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const css = (run.steps[0]?.args as { value: string }).value;
    const { colours } = readPageKit(css, false).state;
    expect(colours).toMatchObject({
      accent: '#b91c1c',
      bg: '#ffffff',
      ink: '#000000',
      surface: '#f5f5f5',
    });
    expect(failingPairs(colours)).toEqual([]);
    const defaultRun = themeApplyTool.run({ radixScale: 'blue' }, liveContext(kernel));
    const lightRun = themeApplyTool.run(
      { radixScale: 'blue', appearance: 'light' },
      liveContext(kernel),
    );
    expect(defaultRun).toEqual(lightRun);
  });

  it('still refuses an explicitly unreadable pair instead of silently overriding it', () => {
    const kernel = fixtureKernel();
    const before = kernel.getDocument();
    const run = themeApplyTool.run(
      { radixScale: 'amber', ink: '#ffffff', bg: '#ffffff' },
      liveContext(kernel),
    );
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error).toContain('below WCAG AA 4.5:1');
    expect(kernel.getDocument()).toEqual(before);
  });

  it.each([
    { radixScale: 'red' },
    { radixScale: 'blueDark' },
    { radixScale: 1 },
    { radixScale: 'blue', appearance: 'auto' },
    { radixScale: 'blue', appearance: 1 },
    { appearance: 'dark' },
    { accent: '#b91c1c', appearance: 'light' },
    { radixScale: 'blue', deckRow: 'cafe' },
    { radixScale: 'blue', alpha: true },
  ])('refuses invalid or ambiguous input %j', (input) => {
    expect(themeApplyTool.parse(input).ok).toBe(false);
  });

  it('keeps named color edits unchanged and leaves explicit scale requests to the model', () => {
    const kernel = fixtureKernel();
    expect(tryDirectTool('make the page green', kernel)).toBeDefined();
    for (const request of [
      'apply Radix blue dark palette',
      'use Radix amber light',
      'استخدم ألوان Radix blue داكن',
    ]) {
      expect(tryDirectTool(request, kernel)).toBeUndefined();
    }
    expect(themeApplyTool.parse({ accent: 'emerald-700' })).toMatchObject({
      ok: true,
      value: { accent: 'emerald-700' },
    });
  });
});
