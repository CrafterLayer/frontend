import { describe, expect, it } from 'vitest';

import { detectPromptLanguage } from './language';
import { tidyRequest, tidyRequestText } from './tidy-request-text';

/*
  The deterministic floor of the ✨ Improve action. Its one law: a spelling of
  the same request, never a different request.
*/

describe('tidyRequestText — spelling fixes that never change the meaning', () => {
  it('fixes the owner’s own example: the split article and the ه typed for ة', () => {
    // The request the panel took literally, 2026-09-28.
    expect(tidyRequest('هل يمكنك تربط ال صفحه هاي داخل عليها')).toEqual({
      text: 'هل يمكنك تربط الصفحة هاي داخل عليها',
      fixes: ['article', 'word-ending'],
    });
  });

  it('folds runs of spaces and tabs, trims each line, and keeps at most one blank line', () => {
    expect(tidyRequest('  اعمل   صفحه\tلمطعمي  \n\n\n\n  في عمان  ')).toEqual({
      text: 'اعمل صفحة لمطعمي\n\nفي عمان',
      fixes: ['spacing', 'word-ending'],
    });
  });

  it('puts the space after a mark, not before it — and leaves numbers alone', () => {
    expect(tidyRequestText('مرحبا ، كيف الحال ؟')).toBe('مرحبا، كيف الحال؟');
    expect(tidyRequestText('مطعم،مقهى؛مخبز')).toBe('مطعم، مقهى؛ مخبز');
    expect(tidyRequestText('red,blue and 1,500 JOD')).toBe('red, blue and 1,500 JOD');
    expect(tidyRequestText('Hello , world .')).toBe('Hello, world.');
    // A mark that does not end a clause keeps its space: ".NET", an ellipsis.
    expect(tidyRequestText('built with .NET and more ...')).toBe('built with .NET and more ...');
  });

  it('collapses a mark typed over and over, leaving mixed marks as typed', () => {
    expect(tidyRequest('Build a page!!! For my café??? Now....')).toEqual({
      text: 'Build a page! For my café? Now...',
      fixes: ['punctuation'],
    });
    expect(tidyRequestText('ممكن تساعدني؟؟؟')).toBe('ممكن تساعدني؟');
    expect(tidyRequestText('Really?!')).toBe('Really?!');
  });

  it('joins ال and لل to the word after them, never onto a word that has its own article', () => {
    expect(tidyRequestText('غير لون ال خلفيه')).toBe('غير لون الخلفية');
    expect(tidyRequestText('اضف رابط لل موقع')).toBe('اضف رابط للموقع');
    expect(tidyRequestText('ال الصفحة')).toBe('ال الصفحة');
    expect(tidyRequestText('ال CEO')).toBe('ال CEO');
    expect(tidyRequestText('ال\nصفحة')).toBe('ال\nصفحة');
  });

  it('fixes the listed endings bare and after every article prefix', () => {
    expect(tidyRequestText('صفحه رئيسيه لشركه')).toBe('صفحة رئيسية لشركه');
    expect(tidyRequestText('بالصوره وللشركه والخلفيه')).toBe('بالصورة وللشركة والخلفية');
    expect(tidyRequestText('كالقهوه فالمزرعه')).toBe('كالقهوة فالمزرعة');
  });

  it('fixes a word whose bare ه is also "his" or "it" only when the article rules that out', () => {
    // Bare: «على طريقه» is "his way", «ترجمه» is "translate it", «دوره» is "his role".
    expect(tidyRequestText('على طريقه')).toBe('على طريقه');
    expect(tidyRequestText('ترجمه للانجليزي')).toBe('ترجمه للانجليزي');
    expect(tidyRequestText('ما دوره')).toBe('ما دوره');
    // With the article it can only be the ة word.
    expect(tidyRequestText('غير الطريقه والترجمه والدوره')).toBe('غير الطريقة والترجمة والدورة');
  });

  it('never touches a ه that belongs to the word or to "his": وجهه، مطعمه، الله، اتجاه، وجوده', () => {
    for (const text of [
      'صورة وجهه',
      'صفحة مطعمه',
      'بسم الله',
      'اتجاه الصفحة',
      'فواكه طازجة',
      'اعرض وجوده',
      'كافيه في عمان',
    ]) {
      expect(tidyRequestText(text)).toBe(text);
    }
  });

  it('leaves links, e-mail addresses and quoted copy exactly as written', () => {
    const link = 'ضع الرابط https://example.com/a?b=1,2!! هنا';
    expect(tidyRequestText(link)).toBe(link);
    expect(tidyRequestText('راسلني على info@cafe.jo')).toBe('راسلني على info@cafe.jo');
    expect(tidyRequest('اكتب في العنوان «صفحه جديده!!»')).toEqual({
      text: 'اكتب في العنوان «صفحه جديده!!»',
      fixes: [],
    });
    expect(tidyRequestText('Headline: "Big  sale!!!" now!!')).toBe('Headline: "Big sale!!!" now!');
  });

  it('leaves an English request that needs nothing exactly as it was', () => {
    const text = 'Build a landing page for my bakery in Amman, with a menu and prices.';
    expect(tidyRequest(text)).toEqual({ text, fixes: [] });
  });

  it('is idempotent: tidying the tidied text changes nothing', () => {
    for (const text of [
      'a !! b',
      'a ،،b',
      'هل يمكنك تربط ال صفحه هاي داخل عليها',
      'مرحبا ، كيف الحال ؟؟ ',
      'Build   a page!!!   Now ....',
      'غير ال طريقه ، و ال خلفيه',
    ]) {
      const once = tidyRequestText(text);
      expect(tidyRequestText(once)).toBe(once);
    }
  });
});

describe('detectPromptLanguage — the draft’s language, by the words that frame it', () => {
  it('reads an Arabic request with a Latin brand in it as Arabic', () => {
    expect(detectPromptLanguage('صفحة لمطعم Burger House')).toBe('ar');
    expect(detectPromptLanguage('أضف قسم بعنوان "Fresh coffee roasted every morning"')).toBe('ar');
  });

  it('reads an English request with an Arabic name in it as English', () => {
    expect(detectPromptLanguage('Build a page for مطعم الريم')).toBe('en');
  });

  it('counts quoted words only when nothing else is there, and says nothing for no words', () => {
    expect(detectPromptLanguage('"Fresh coffee"')).toBe('en');
    expect(detectPromptLanguage('+962 7 9000 0000')).toBeUndefined();
  });
});
