import { describe, expect, it } from 'vitest';

import { ELEMENT_NAME_WORDS_AR, ELEMENT_NAME_WORDS_EN } from '../custom-code/element-target';
import { customCodeElementName } from './custom-code-element-name';

describe('customCodeElementName', () => {
  it('names the things a person points at, in the words they would use', () => {
    expect(customCodeElementName({ kind: 'element', tag: 'img' })).toBe('Image');
    expect(customCodeElementName({ kind: 'element', tag: 'h1' })).toBe('Heading');
    expect(customCodeElementName({ kind: 'element', tag: 'h4' })).toBe('Heading');
    expect(customCodeElementName({ kind: 'element', tag: 'p' })).toBe('Paragraph');
    expect(customCodeElementName({ kind: 'element', tag: 'a' })).toBe('Link');
    expect(customCodeElementName({ kind: 'element', tag: 'button' })).toBe('Button');
    expect(customCodeElementName({ kind: 'element', tag: 'span' })).toBe('Text');
    expect(customCodeElementName({ kind: 'element', tag: 'strong' })).toBe('Text');
    expect(customCodeElementName({ kind: 'element', tag: 'ul' })).toBe('List');
    expect(customCodeElementName({ kind: 'element', tag: 'li' })).toBe('List item');
    expect(customCodeElementName({ kind: 'element', tag: 'section' })).toBe('Section');
    expect(customCodeElementName({ kind: 'element', tag: 'div' })).toBe('Container');
    expect(customCodeElementName({ kind: 'element', tag: 'figure' })).toBe('Figure');
    expect(customCodeElementName({ kind: 'element', tag: 'figcaption' })).toBe('Caption');
    expect(customCodeElementName({ kind: 'element', tag: 'blockquote' })).toBe('Quote');
    expect(customCodeElementName({ kind: 'element', tag: 'hr' })).toBe('Divider');
    expect(customCodeElementName({ kind: 'element', tag: 'nav' })).toBe('Navigation');
  });

  it('names an icon by its glyph and a component reference by its block type', () => {
    expect(customCodeElementName({ kind: 'icon', name: 'mail' })).toBe('Icon (mail)');
    expect(customCodeElementName({ kind: 'component', component: 'pricingTable' })).toBe(
      'Pricing Table',
    );
  });

  it('falls back to the tag itself for a vocabulary entry it has no word for', () => {
    // The tag enum can grow before this table does; a raw tag is still a name.
    expect(customCodeElementName({ kind: 'element', tag: 'time' })).toBe('Time');
    expect(customCodeElementName({ kind: 'element', tag: 'article' })).toBe('Article');
  });
});

describe('customCodeElementName in the editor language (arabic-editor)', () => {
  it('names elements, icons and components in Arabic from the words it is given', () => {
    const ar = ELEMENT_NAME_WORDS_AR;
    expect(customCodeElementName({ kind: 'element', tag: 'h2' }, ar)).toBe('عنوان');
    expect(customCodeElementName({ kind: 'element', tag: 'img' }, ar)).toBe('صورة');
    expect(customCodeElementName({ kind: 'element', tag: 'pre' }, ar)).toBe('عنصر');
    expect(customCodeElementName({ kind: 'icon', name: 'mail' }, ar)).toBe('أيقونة (mail)');
    expect(customCodeElementName({ kind: 'component', component: 'accordion' }, ar)).toBe('أقسام قابلة للطي');
  });

  it('keeps its own English table when given the English words', () => {
    expect(customCodeElementName({ kind: 'element', tag: 'p' }, ELEMENT_NAME_WORDS_EN)).toBe('Paragraph');
  });
});
