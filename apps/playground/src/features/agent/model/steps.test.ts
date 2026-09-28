/** A change plan's steps (SPEC §4.12): one per line the model wrote, its list markers taken off. */
import { describe, expect, it } from 'vitest';

import { stepsOf } from './steps';

describe('stepsOf', () => {
  it('numbers each written line once, and names the block the request was about', () => {
    expect(stepsOf('1. Darken the hero.\n\n- Add a WhatsApp button\n• Keep the photo', 'Hero')).toEqual([
      { key: 'step-1', text: 'Darken the hero.', target: 'Hero' },
      { key: 'step-2', text: 'Add a WhatsApp button', target: 'Hero' },
      { key: 'step-3', text: 'Keep the photo', target: 'Hero' },
    ]);
  });

  it('reads Arabic-Indic numbering and a page-wide plan', () => {
    expect(stepsOf('١. جعل الخلفية داكنة\n٢- إضافة زر')).toEqual([
      { key: 'step-1', text: 'جعل الخلفية داكنة' },
      { key: 'step-2', text: 'إضافة زر' },
    ]);
  });
});
