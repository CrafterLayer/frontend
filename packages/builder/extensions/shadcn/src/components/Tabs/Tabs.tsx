import { Children, isValidElement } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';

import type { BlockRenderProps } from '@craftkit/builder-schema';
import { motionAttributes } from '@craftkit/builder-renderer';

import type { TabsProps } from './schema';

/**
 * shadcn/ui's Tabs, on Radix, as a builder block.
 *
 * ## Where the labels come from
 *
 * From the DOCUMENT, never from the rendered children. `node.slots` holds the
 * child ids and `document` is not available here, so each panel carries its own
 * label in its props and this reads them off the child ELEMENTS' props — which
 * is React data, present identically on the canvas and in static output.
 *
 * The tempting alternative — reading `data-bldr-node` or text content off the
 * DOM — is the mistake the Accordion already made once: that attribute is
 * canvas scaffolding, so the tabs would have worked while editing and rendered
 * unlabelled once published.
 *
 * ## What Radix is doing that is worth the dependency
 *
 * Roving tabindex, arrow-key navigation with Home/End, the
 * `aria-controls`/`aria-labelledby` pairing between every trigger and its
 * panel, and focus moving to the panel on activation. A tab strip is four
 * lines of state and forty of accessibility, and the forty are the part
 * everyone reimplements incorrectly.
 */
interface PanelSummary {
  readonly id: string;
  readonly label: string;
}

/**
 * Read `{ id, label }` off each panel child.
 *
 * Both fields are REQUIRED, and a child missing either is skipped rather than
 * given a positional name. The forgiving version produced a phantom tab: the
 * canvas renders a drop placeholder into an empty slot, that placeholder is a
 * valid React element, and a fallback label turned it into a tab called
 * "Tab 1" that existed only while editing. A tab strip that disagrees with the
 * published page is worse than one that is briefly empty.
 */
function summarise(children: React.ReactNode): PanelSummary[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) {
      return [];
    }
    const props = child.props as { node?: { id?: unknown }; props?: { label?: unknown } };
    const id = props.node?.id;
    const label = props.props?.label;
    if (typeof id !== 'string' || typeof label !== 'string') {
      return [];
    }
    return [{ id, label }];
  });
}

const ALIGN_CLASSES: Record<TabsProps['align'], string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

export function Tabs({ node, props, slots }: BlockRenderProps<TabsProps>) {
  const { class: motionClassName, ...motionData } = motionAttributes(props.motion);
  const panels = summarise(slots['default']);
  const first = panels[0];

  if (first === undefined) {
    /*
      An empty tab strip renders nothing rather than an empty chrome bar. On the
      canvas the slot placeholder still shows, so a person adding the block is
      not left guessing.
    */
    return <div className={clsx('flex min-w-0 flex-col', props.className)}>{slots['default']}</div>;
  }

  return (
    <RadixTabs.Root
      defaultValue={first.id}
      className={clsx(
        'flex min-w-0 flex-col gap-4',
        motionClassName,
        /* The document's own utilities go LAST, so a caller wins a conflict. */
        props.className,
      )}
      data-bldr-tabs={node.id}
      {...motionData}
    >
      <RadixTabs.List
        className={clsx(
          'flex min-w-0 flex-wrap items-center gap-1 rounded-lg bg-surface-inverse p-1',
          ALIGN_CLASSES[props.align],
        )}
      >
        {panels.map((panel) => (
          <RadixTabs.Trigger
            key={panel.id}
            value={panel.id}
            /*
              `data-[state=active]` rather than a class toggled in JavaScript.
              Radix writes the attribute; the styling follows it, so the active
              tab is correct on the first paint and during hydration — there is
              no frame where every tab looks selected.
            */
            className="min-w-0 rounded-md px-4 py-2 text-sm font-medium text-text-inverse data-[state=active]:bg-accent data-[state=active]:text-accent-text"
          >
            {panel.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {slots['default']}
    </RadixTabs.Root>
  );
}
