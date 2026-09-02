import type { CustomCodeNode } from '@craftkit/builder-schema';

import { displayNameForBlockType } from './block-display-name';

/**
 * What to call one authored element in the chrome — the canvas chip, the
 * Inspector title, the selection announcement.
 *
 * A tag is the vocabulary the ASSISTANT writes in; a person pointing at the
 * canvas thinks "the photo", "the headline", "the button". The table is
 * deliberately short and plain: every heading level is a heading, every inline
 * phrase element is text. A tag outside it still gets a readable word, so the
 * schema's vocabulary can grow before this table does.
 */
const ELEMENT_NAMES: Readonly<Record<string, string>> = {
  a: 'Link',
  article: 'Article',
  aside: 'Aside',
  blockquote: 'Quote',
  br: 'Line break',
  button: 'Button',
  code: 'Code',
  div: 'Container',
  em: 'Text',
  figcaption: 'Caption',
  figure: 'Figure',
  footer: 'Footer',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  h5: 'Heading',
  h6: 'Heading',
  header: 'Header',
  hr: 'Divider',
  img: 'Image',
  li: 'List item',
  main: 'Main',
  nav: 'Navigation',
  ol: 'List',
  p: 'Paragraph',
  pre: 'Code block',
  section: 'Section',
  small: 'Text',
  span: 'Text',
  strong: 'Text',
  sub: 'Text',
  sup: 'Text',
  time: 'Time',
  ul: 'List',
};

export function customCodeElementName(node: CustomCodeNode): string {
  switch (node.kind) {
    case 'icon':
      return `Icon (${node.name})`;
    case 'component':
      return displayNameForBlockType(node.component);
    case 'element':
      return ELEMENT_NAMES[node.tag] ?? displayNameForBlockType(node.tag);
  }
}
