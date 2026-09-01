import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { TabPanelProps } from './schema';

/**
 * One panel in a tab strip.
 *
 * ## Why the panel owns its own label
 *
 * The alternative was an array of `{ label, content }` on the Tabs block — and
 * that is the shape that made a button inside a Pricing card impossible. A
 * panel holds BLOCKS, so it has to be a node; and a node that is a tab needs
 * its own name, so the label lives here.
 *
 * `value` is the node id, which is what pairs this panel with its trigger.
 * The parent receives the same id through the builder's typed child metadata,
 * so the two agree without inspecting this component or touching the DOM.
 */
export function TabPanel({ node, props, slots }: BlockRenderProps<TabPanelProps>) {
  return (
    <RadixTabs.Content
      value={node.id}
      className={clsx(
        'flex min-w-0 flex-col gap-4',
        /*
          Radix moves focus here on activation, so it takes a focus ring —
          without one, a keyboard user is moved somewhere invisible.
        */
        'focus-visible:outline focus-visible:outline-accent',
        props.className,
      )}
    >
      {slots['default']}
    </RadixTabs.Content>
  );
}
