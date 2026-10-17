import { describe, expect, it } from 'vitest';

import { lightTheme } from '@craftkit/builder-schema';

import { normalizeIntentText } from '../../intent/normalize-arabic';
import { partsKernel } from '../../style-tools/part-tools.fixtures';
import { directQuestion, tryDirectTool } from './direct-tool';
import { askElementColour, nearestThemeRole, readElementColour } from './element-colour';

/*
  block-parts (2026-10-06): the zero-token colour reading on REGISTERED
  blocks. «غيّر لون العنوان في الهيرو» means the hero's `heading` part; the
  colour maps to the nearest theme role (tokens law) and lands as ONE
  part.style setProp of `partStyles`; a colour no role carries asks first.
*/

const fold = (text: string) => normalizeIntentText(text);

function partStylesOf(steps: readonly { readonly args: Record<string, unknown> }[] | undefined) {
  expect(steps).toHaveLength(1);
  const [step] = steps ?? [];
  expect(step?.args['key']).toBe('partStyles');
  return { id: step?.args['id'], value: step?.args['value'] as Record<string, { className?: string }> };
}

describe('element colour on the parts of registered blocks', () => {
  it('«غيّر لون العنوان في الهيرو للأزرق» → hero.heading, part.style with the accent role', () => {
    const kernel = partsKernel('ar');
    const reading = readElementColour(fold('غيّر لون العنوان في الهيرو للأزرق'), kernel);
    const { id, value } = partStylesOf(reading?.steps);
    expect(id).toBe('hero-1');
    expect(value).toEqual({ heading: { className: 'text-accent' } });
    expect(reading?.label.ar).toContain('«العنوان»');
  });

  it('the same request lands through the direct path as one validated plan', () => {
    const direct = tryDirectTool('غيّر لون العنوان في الهيرو للأزرق', partsKernel('ar'));
    expect(direct?.plan.commands).toHaveLength(1);
    expect(direct?.plan.commands[0]).toMatchObject({ command: 'setProp', args: { id: 'hero-1', key: 'partStyles' } });
  });

  it('reads English the same way', () => {
    const reading = readElementColour(fold('make the hero heading blue'), partsKernel());
    expect(partStylesOf(reading?.steps).value).toEqual({ heading: { className: 'text-accent' } });
  });

  it('a green request takes the success role', () => {
    const reading = readElementColour(fold('اجعل الوصف في الهيرو أخضر'), partsKernel('ar'));
    expect(partStylesOf(reading?.steps).value).toEqual({ body: { className: 'text-success' } });
  });

  it('colours every card title of a list when no single one is named', () => {
    const reading = readElementColour(fold('make the features card title grey'), partsKernel());
    const { id, value } = partStylesOf(reading?.steps);
    expect(id).toBe('features-1');
    expect(Object.keys(value)).toEqual(['item.title']);
    expect(value['item.title']?.className).toMatch(/^text-text(?:-muted)?(?:\/\d+)?$/u);
  });

  it('a red request with no red role writes nothing and asks, with two choices', () => {
    const kernel = partsKernel('ar');
    const request = 'اجعل العنوان في الهيرو أحمر';
    expect(readElementColour(fold(request), kernel)).toBeUndefined();
    expect(tryDirectTool(request, kernel)).toBeUndefined();
    const question = askElementColour(fold(request), kernel);
    expect(question?.choices.map(({ id }) => id)).toEqual(['accent', 'convert']);
    expect(question?.ar).toContain('«العنوان»');
    expect(question?.en).toContain('Convert to editable');
    expect(directQuestion(request, kernel)).toBe(question?.ar);
    expect(directQuestion('make the hero heading red', partsKernel())).toContain('Convert to editable');
  });

  it('a request that names no colour asks which one', () => {
    const question = askElementColour(fold('غيّر لون العنوان في الهيرو'), partsKernel('ar'));
    expect(question?.ar).toContain('أي لون');
    expect(question?.ar).toContain('«العنوان»');
  });

  it('the accent choice reads as a follow-up', () => {
    const reading = readElementColour(fold('غيّر لون العنوان في الهيرو إلى لون التمييز'), partsKernel('ar'));
    expect(partStylesOf(reading?.steps).value).toEqual({ heading: { className: 'text-accent' } });
  });

  it('measures against the theme it is given', () => {
    const kernel = partsKernel('ar');
    const reading = readElementColour(fold('اجعل العنوان في الهيرو أحمر'), kernel, { theme: { accent: '#b91c1c' } });
    expect(partStylesOf(reading?.steps).value).toEqual({ heading: { className: 'text-accent' } });
  });

  it('steps aside when the part is ambiguous or the section is unknown', () => {
    const kernel = partsKernel();
    // Two blocks have a heading and no section is named.
    expect(readElementColour(fold('make the heading blue'), kernel)).toBeUndefined();
    // Two CTA buttons sit in the hero.
    expect(readElementColour(fold('make the hero button green'), kernel)).toBeUndefined();
    expect(askElementColour(fold('make the heading blue'), kernel)).toBeUndefined();
  });
});

describe('nearestThemeRole', () => {
  it('maps a colour to a theme role within tolerance, else nothing', () => {
    expect(nearestThemeRole('emerald-700', lightTheme)?.token).toBe('success');
    expect(nearestThemeRole('blue-700', lightTheme)?.role).toBe('accent');
    expect(nearestThemeRole('#111827', lightTheme)?.token).toBe('text');
    expect(nearestThemeRole('red-700', lightTheme)).toBeUndefined();
    expect(nearestThemeRole('amber-400', lightTheme)).toBeUndefined();
  });
});
