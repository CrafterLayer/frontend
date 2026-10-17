import * as RadixAccordion from '@radix-ui/react-accordion';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { AccordionProps } from './schema';

import './Accordion.css';

/**
 * A list of collapsible sections.
 *
 * Radix owns the behaviour — roving focus, arrow keys, Home/End, the
 * `aria-expanded`/`aria-controls` pairing, and the disclosure semantics that
 * make this announce correctly. Vendoring that judgment rather than re-deriving
 * it is the point: an accordion is three lines of state and about forty of
 * accessibility, and the forty are the part everyone gets wrong.
 *
 * What this block owns is the BOUNDARY — which children are legal, what the
 * document may store, and the fact that every value is a named intent rather
 * than a literal.
 */
export function Accordion({ node, props, slots }: BlockRenderProps<AccordionProps>) {
  /*
    The first item's id comes from the DOCUMENT, not from the rendered children.

    Reading it off child elements was the first attempt and it was wrong in a
    way only the published page would have shown: `data-bldr-node` is canvas
    scaffolding, present in the editor and absent from static output, so the
    accordion would have opened correctly while editing and opened nothing once
    published. `node.slots` is document data and reads the same on both paths.
  */
  const firstItemId = node.slots?.['default']?.[0];
  const children = slots['default'];

  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const className = ['pri-accordion', motionClassName].filter(Boolean).join(' ');

  /*
    The two modes are separate elements rather than one with a widened prop.
    Radix types `value`/`defaultValue` as a string for `single` and a string
    array for `multiple`, and collapsing them behind a cast introduces a runtime
    error at exactly the boundary those types were guarding.
  */
  if (props.mode === 'multiple') {
    return (
      <RadixAccordion.Root
        type="multiple"
        className={className}
        defaultValue={
          props.defaultOpen === 'first' && firstItemId !== undefined ? [firstItemId] : []
        }
        data-bldr-accordion={node.id}
        {...motionData}
      >
        {children}
      </RadixAccordion.Root>
    );
  }

  return (
    <RadixAccordion.Root
      type="single"
      className={className}
      collapsible={props.collapsible}
      {...(props.defaultOpen === 'first' && firstItemId !== undefined
        ? { defaultValue: firstItemId }
        : {})}
      data-bldr-accordion={node.id}
      {...motionData}
    >
      {children}
    </RadixAccordion.Root>
  );
}
