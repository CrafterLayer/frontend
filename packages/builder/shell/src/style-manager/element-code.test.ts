import { describe, expect, it } from 'vitest';

import type { CustomCodeElement } from '@craftkit/builder-schema';

import { attributeInMessage, formatElementCode, parseElementCode, patchFromCode } from './element-code';

const link: CustomCodeElement = {
  kind: 'element',
  tag: 'a',
  className: 'text-lg underline',
  text: 'Read "more" & go',
  attributes: { href: '/about', target: '_blank' },
};

describe('element code', () => {
  it('round-trips an element: format → parse gives the same element back', () => {
    const code = formatElementCode(link);
    expect(code).toBe('<a class="text-lg underline" href="/about" target="_blank">Read "more" &amp; go</a>');
    const parsed = parseElementCode(code);
    expect(parsed).toEqual({
      ok: true,
      value: { tag: 'a', className: 'text-lg underline', attributes: { href: '/about', target: '_blank' }, text: 'Read "more" & go' },
    });
    expect(parsed.ok && patchFromCode(link, parsed.value)).toEqual({});
  });

  it('collapses children to a marker and keeps them', () => {
    const section: CustomCodeElement = {
      kind: 'element',
      tag: 'section',
      className: 'grid',
      children: [{ kind: 'element', tag: 'p', text: 'x' }],
    };
    const code = formatElementCode(section);
    expect(code).toBe('<section class="grid">…</section>');
    const parsed = parseElementCode('<section class="grid gap-4">…</section>');
    expect(parsed.ok && patchFromCode(section, parsed.value)).toEqual({ set: { className: 'grid gap-4' } });
  });

  it('diffs into one patch: changed class, new and removed attributes', () => {
    const parsed = parseElementCode('<a class="text-xl" href="/team">Read "more" &amp; go</a>');
    expect(parsed.ok && patchFromCode(link, parsed.value)).toEqual({
      set: { className: 'text-xl' },
      attributes: { href: '/team', target: null },
    });
  });

  it('refuses with the place it stopped and the attribute it is about', () => {
    const style = parseElementCode('<p style="color:red">x</p>');
    expect(style).toMatchObject({ ok: false, error: { attribute: 'style', offset: 3 } });
    const handler = parseElementCode('<p onclick="x()">x</p>');
    expect(handler).toMatchObject({ ok: false, error: { attribute: 'onclick' } });
    expect(parseElementCode('<p class=big>x</p>')).toMatchObject({ ok: false, error: { attribute: 'class' } });
    expect(parseElementCode('<p>x')).toMatchObject({ ok: false });
    expect(parseElementCode('<p>a <b>b</b></p>')).toMatchObject({ ok: false });
    expect(parseElementCode('hello')).toMatchObject({ ok: false, error: { offset: 0 } });
  });

  it('reads void tags and boolean attributes', () => {
    expect(parseElementCode('<img src="https://x.io/a.jpg" alt="A">')).toMatchObject({
      ok: true,
      value: { tag: 'img', attributes: { src: 'https://x.io/a.jpg', alt: 'A' }, text: undefined },
    });
  });

  it('finds the attribute a door refusal names', () => {
    expect(attributeInMessage("data-ck-target='x' must name an id in this tree", ['id', 'data-ck-target'])).toBe(
      'data-ck-target',
    );
    expect(attributeInMessage('nothing here', ['href'])).toBeUndefined();
  });
});
