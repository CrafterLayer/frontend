import { describe, expect, it } from 'vitest';

import { foldIntentText, prefersScriptServer } from './script-intent';

/*
  The server copy on its own terms. Parity with builder-ai's `prefersScript`
  over its 30+ row table is script-card.test.ts's job; these pin the fold and
  the readings the edit prompt's tip depends on.
*/
describe('foldIntentText', () => {
  it('folds the Arabic letter variants a person types interchangeably', () => {
    expect(foldIntentText('الأزرار')).toBe('الازرار');
    expect(foldIntentText('إضافة آخر')).toBe('اضافه اخر');
    expect(foldIntentText('على')).toBe('علي');
    expect(foldIntentText('خلّي كـــل')).toBe('خلي كل');
  });

  it('reads Arabic-Indic digits and punctuation as Latin, lowercases and trims', () => {
    expect(foldIntentText('  ضيف ٦ أعضاء؟ ')).toBe('ضيف 6 اعضاء?');
    expect(foldIntentText('Round  EVERY\nButton')).toBe('round every button');
  });
});

describe('prefersScriptServer', () => {
  it.each([
    'خلي كل الأزرار مدورة',
    'خلّي جميع العناوين باللون الأزرق',
    'الأزرار كلها خليها سوداء',
    'translate all headings',
    'round every button',
    'ضيف 12 طبق للمنيو بأسعار من 2 لـ 8 دنانير',
    'ضيف ٦ أعضاء للفريق',
    'add twelve dishes to the menu',
    'غيّر اسم الشركة على كل الصفحات',
    'rename the brand across all pages',
  ])('reads %s as bulk work', (request) => {
    expect(prefersScriptServer(request)).toBe(true);
  });

  it.each([
    'make the hero title bigger',
    'كبّر عنوان الهيرو',
    'change the price to 8 JOD',
    'اعمل صفحة هبوط لمطعم',
    'add a testimonials section',
    '',
    '   ',
  ])('leaves %j to plain steps or generation', (request) => {
    expect(prefersScriptServer(request)).toBe(false);
  });
});
