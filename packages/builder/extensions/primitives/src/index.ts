/*
  @craftkit/builder-primitives — the CURATED primitive catalog (layer 4).

  Domain-agnostic interactive primitives every product pack composes from:
  marketing, commerce, and dashboards all need an accordion, and none of them
  should own one.

  ## Why these are vendored rather than written

  An accordion is three lines of state and about forty of accessibility, and
  the forty are the part everyone gets wrong — roving focus, arrow keys,
  Home/End, the aria-expanded/aria-controls pairing, disclosure semantics. Radix
  has already made those judgments and had them reviewed by more people than
  this project will ever have. What is written here is the BOUNDARY around
  them: which children are legal, what the document may store, and the rule that
  every stored value is a named intent rather than a literal.

  ## Why this pack exists separately from blocks-marketing

  It is the second extension pack, and that is the point. If one engine cannot
  cleanly host two packs, the multi-product thesis is wrong and this is the
  cheapest possible place to find out.
*/
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { Accordion, accordionSchema } from './components/Accordion';
import { AccordionItem, accordionItemSchema } from './components/AccordionItem';

export const builderPrimitives: TrustedExtensionManifest = {
  tier: 1,
  name: 'primitives',
  version: '0.1.0',
  contributes: {
    blocks: [
      // The container first: it is what the items go inside.
      { schema: accordionSchema, render: Accordion },
      { schema: accordionItemSchema, render: AccordionItem },
    ],
  },
};

export { Accordion, accordionSchema, type AccordionProps } from './components/Accordion';
export {
  AccordionItem,
  accordionItemSchema,
  type AccordionItemProps,
} from './components/AccordionItem';
