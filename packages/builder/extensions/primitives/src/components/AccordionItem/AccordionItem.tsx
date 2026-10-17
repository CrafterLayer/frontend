import * as RadixAccordion from '@radix-ui/react-accordion';

import { blockPartProps, type BlockRenderProps } from '@craftkit/builder-schema';

import { accordionItemSchema, type AccordionItemProps } from './schema';

import './AccordionItem.css';

/**
 * One collapsible section: a heading a reader can activate, and the content
 * revealed underneath it.
 *
 * The item's Radix `value` is its NODE ID. That is not a convenience — it is
 * the only identifier that is stable across renders, unique by construction,
 * and already the thing every other part of the builder uses to name a node.
 * A separate numbering scheme would be a second identity to keep in step, and
 * it would drift the first time someone reordered the items.
 *
 * `props.title` is rendered as a child rather than copied into an attribute so
 * the trigger takes its accessible name from the VISIBLE text. Inline editing
 * swaps that property for an editor element, and an element placed in
 * `aria-label` stringifies to "[object Object]".
 */
export function AccordionItem({
  node,
  props,
  slots,
  isCanvas,
}: BlockRenderProps<AccordionItemProps>) {
  const part = blockPartProps({ node, props, isCanvas }, accordionItemSchema.parts);
  return (
    <RadixAccordion.Item className="pri-accordion-item" value={node.id}>
      <RadixAccordion.Header className="pri-accordion-item__header">
        <RadixAccordion.Trigger {...part('trigger', { className: 'pri-accordion-item__trigger' })}>
          <span {...part('title', { className: 'pri-accordion-item__title' })}>{props.title}</span>
          {/*
            Decorative, and marked so. The trigger already announces its state
            through `aria-expanded`; a chevron a screen reader also reads is
            the same information twice.
          */}
          <span className="pri-accordion-item__chevron" aria-hidden="true" />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content className="pri-accordion-item__content">
        <div className="pri-accordion-item__body">{slots['default']}</div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  );
}
