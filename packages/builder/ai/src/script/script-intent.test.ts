import { describe, expect, it } from 'vitest';

import { PREFERS_SCRIPT_TABLE, prefersScript } from './script-intent';

describe('prefersScript', () => {
  it('the drift table has at least 30 rows, both answers, both languages', () => {
    expect(PREFERS_SCRIPT_TABLE.length).toBeGreaterThanOrEqual(30);
    expect(PREFERS_SCRIPT_TABLE.some(({ expected }) => expected)).toBe(true);
    expect(PREFERS_SCRIPT_TABLE.some(({ expected }) => !expected)).toBe(true);
    expect(PREFERS_SCRIPT_TABLE.some(({ text }) => /[؀-ۿ]/u.test(text))).toBe(true);
    expect(PREFERS_SCRIPT_TABLE.some(({ text }) => /^[\x20-\x7E]+$/u.test(text))).toBe(true);
  });

  it.each(PREFERS_SCRIPT_TABLE.map(({ text, expected }) => [text, expected] as const))('%s → %s', (text, expected) => {
    expect(prefersScript(text)).toBe(expected);
  });

  it('reads Arabic variants and Arabic-Indic digits the same way', () => {
    expect(prefersScript('خلي كل الازرار مدوره')).toBe(true);
    expect(prefersScript('ضيف ١٢ طبق')).toBe(true);
    expect(prefersScript('صمم قائمة الطعام باستخدام صور')).toBe(false);
    expect(prefersScript('')).toBe(false);
  });
});
