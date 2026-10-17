import { Script } from 'node:vm';

import { afterAll, describe, expect, it } from 'vitest';

import { applyAiPlan } from '../plan/apply-plan';
import { validateAiPlan } from '../plan/validate-plan';
import { directScript, directScriptReading, type DirectScriptReading } from './direct-scripts';
import { expandScriptSteps } from './expand-scripts';
import { createInlineScriptRunner } from './runner-inline';
import { arabicKernel, buttonsKernel, policyOf, scriptPlan, scriptPorts } from './script.fixtures';

const runner = createInlineScriptRunner();
afterAll(() => {
  runner.dispose();
});

const READINGS: readonly (readonly [string, DirectScriptReading])[] = [
  ['خلي كل الأزرار مدورة', 'round-buttons'],
  ['اجعل جميع الأزرار دائرية', 'round-buttons'],
  ['دوّر كل الأزرار', 'round-buttons'],
  ['round all buttons', 'round-buttons'],
  ['Round every button', 'round-buttons'],
  ['make all the buttons rounded', 'round-buttons'],
  ['كل الصور بزوايا مدورة', 'round-images'],
  ['خلي كل الصور زواياها مدورة', 'round-images'],
  ['round the corners of all images', 'round-images'],
  ['round all photos', 'round-images'],
  ['ظل لكل البطاقات', 'card-shadow'],
  ['حط ظل لكل الكروت', 'card-shadow'],
  ['shadow on all cards', 'card-shadow'],
  ['add a shadow to every card', 'card-shadow'],
  ['حوّل الأرقام لأرقام عربية', 'arabic-digits'],
  ['خلي الأرقام هندية', 'arabic-digits'],
  ['use Arabic digits', 'arabic-digits'],
  ['switch to Arabic-Indic numerals', 'arabic-digits'],
  ['خلي الأرقام إنجليزية', 'latin-digits'],
  ['حول الارقام لارقام انجليزية', 'latin-digits'],
  ['use Latin digits', 'latin-digits'],
  ['use western numerals', 'latin-digits'],
];

const NEGATIVES = [
  'خلي زر الهيرو مدور',
  'round the hero button',
  'round all buttons except the footer ones',
  'كل الأزرار مدورة ما عدا زر التذييل',
  'round all buttons and make the footer dark',
  'خلي كل الأزرار مدورة وغير لون الخلفية',
  'add a gallery of 6 photos',
  'make the headings bold',
  'اكتب عنوان جديد',
  'use Arabic numerals in the price table',
];

describe('directScriptReading', () => {
  it.each(READINGS)('%s → %s', (request, reading) => {
    expect(directScriptReading(request)).toBe(reading);
  });

  it.each(NEGATIVES)('%s → none', (request) => {
    expect(directScriptReading(request)).toBeUndefined();
  });
});

describe('directScript', () => {
  it('returns plain JavaScript that parses, with a note in the page language', () => {
    for (const [request] of READINGS) {
      for (const lang of ['ar', 'en']) {
        const code = directScript(request, lang);
        expect(code).toBeDefined();
        // Compiled, never run: the body of a function of `ck`, as the sandbox wraps it.
        expect(() => new Script(`(function (ck) {\n${code ?? ''}\n})`)).not.toThrow();
      }
    }
    expect(directScript('round all buttons', 'ar')).toContain("ck.note('تدوير كل الأزرار')");
    expect(directScript('round all buttons', { lang: 'en' })).toContain("ck.note('Round every button')");
    expect(directScript('make the hero bigger', 'en')).toBeUndefined();
  });

  it('round-every-button lands as door-valid steps titled by its note', async () => {
    const kernel = buttonsKernel();
    const code = directScript('Round every button', 'en') ?? '';
    const expansion = await expandScriptSteps(scriptPlan(code), kernel, { runner, policy: policyOf(kernel) });
    expect(expansion.issues).toEqual([]);
    const commands = (expansion.plan as { commands: { title?: string }[] }).commands;
    expect(commands).toHaveLength(3);
    expect(commands[0]?.title).toBe('Round every button');
    expect(validateAiPlan(expansion.plan, kernel, scriptPorts(), policyOf(kernel)).ok).toBe(true);
  });

  it('the digit scripts rewrite every number, in both directions, and skip mixed parents', async () => {
    const kernel = arabicKernel();
    const toArab = await expandScriptSteps(scriptPlan(directScript('حوّل الأرقام لأرقام عربية', 'ar') ?? ''), kernel, {
      runner,
      policy: policyOf(kernel),
    });
    expect(toArab.issues).toEqual([]);
    const judged = validateAiPlan(toArab.plan, kernel, scriptPorts(), policyOf(kernel));
    if (!judged.ok) throw new Error(judged.issues.map(({ message }) => message).join('\n'));
    applyAiPlan({ kernel, plan: judged.plan, policy: policyOf(kernel), validationPorts: scriptPorts() });
    const after = JSON.stringify(kernel.getDocument().nodes);
    for (const text of ['منذ ١٩٩٨', '٠٧٩٠٠٠٠٠٠٠', 'نحمّص ٣ مرات', '© بُن ٢٠٢٤']) expect(after).toContain(text);

    const back = await expandScriptSteps(scriptPlan(directScript('خلي الأرقام إنجليزية', 'ar') ?? ''), kernel, {
      runner,
      policy: policyOf(kernel),
    });
    expect(back.issues).toEqual([]);
    const again = validateAiPlan(back.plan, kernel, scriptPorts(), policyOf(kernel));
    if (!again.ok) throw new Error(again.issues.map(({ message }) => message).join('\n'));
    applyAiPlan({ kernel, plan: again.plan, policy: policyOf(kernel), validationPorts: scriptPorts() });
    const restored = JSON.stringify(kernel.getDocument().nodes);
    for (const text of ['منذ 1998', '0790000000', '© بُن 2024']) expect(restored).toContain(text);
  });
});
