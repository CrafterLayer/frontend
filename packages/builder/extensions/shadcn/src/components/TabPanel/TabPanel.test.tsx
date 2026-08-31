import { cleanup, render, screen } from '@testing-library/react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { afterEach, describe, expect, it } from 'vitest';

import { TabPanel } from './TabPanel';
import { tabPanelSchema } from './schema';

afterEach(cleanup);

/*
  Radix's Content asserts it is inside a Root, which is correct — a panel with
  no strip has nothing to be controlled by. The wrapper is the real context,
  not a mock of one.
*/
const renderPanel = (id = 'monthly', overrides: Record<string, unknown> = {}) =>
  render(
    <RadixTabs.Root defaultValue={id}>
      <RadixTabs.List>
        <RadixTabs.Trigger value={id}>Monthly</RadixTabs.Trigger>
      </RadixTabs.List>
      <TabPanel
        node={{ id, type: 'tabPanel', props: {} }}
        props={tabPanelSchema.props.parse(overrides)}
        slots={{ default: <p>Pay monthly</p> }}
        data={{}}
        isCanvas={false}
      />
    </RadixTabs.Root>,
  );

describe('TabPanel', () => {
  it('renders its content inside a tabpanel', () => {
    renderPanel();

    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByText('Pay monthly')).toBeInTheDocument();
  });

  /*
    The pairing is by NODE ID, which is document data — not by index, and not
    by anything read off the DOM. `data-bldr-node` is canvas scaffolding and
    would have paired correctly while editing and not at all once published.
  */
  it('pairs with its trigger through the node id', () => {
    renderPanel('monthly');

    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('tab').id,
    );
  });

  it('takes a focus ring, because Radix moves focus here on activation', () => {
    renderPanel();

    /* Moving a keyboard user somewhere invisible is worse than not moving them. */
    expect(screen.getByRole('tabpanel').className).toContain('focus-visible:outline');
  });

  it('schema: keeps the label short enough to stay one row', () => {
    expect(tabPanelSchema.props.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
    expect(tabPanelSchema.props.parse({}).label).toBe('Tab');
  });

  it('schema: refuses a class the design system cannot reach', () => {
    expect(tabPanelSchema.props.safeParse({ className: 'p-[13px]' }).success).toBe(false);
    expect(tabPanelSchema.props.safeParse({ className: 'gap-6' }).success).toBe(true);
  });
});
