import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { TabPanel } from '../TabPanel/TabPanel';
import { tabPanelSchema } from '../TabPanel/schema';

import { Tabs } from './Tabs';
import { tabsSchema } from './schema';

afterEach(cleanup);

const node = { id: 'tabs-1', type: 'tabs', props: {} };

const panel = (id: string, label: string, body: string) => (
  <TabPanel
    key={id}
    node={{ id, type: 'tabPanel', props: {} }}
    props={tabPanelSchema.props.parse({ label })}
    slots={{ default: <p>{body}</p> }}
    data={{}}
    isCanvas={false}
  />
);

const renderTabs = (children: React.ReactNode, overrides: Record<string, unknown> = {}) =>
  render(
    <Tabs
      node={node}
      props={tabsSchema.props.parse(overrides)}
      slots={{ default: children }}
      data={{}}
      isCanvas={false}
    />,
  );

describe('Tabs', () => {
  it('builds one trigger per panel, named by the panel', () => {
    renderTabs([panel('m', 'Monthly', 'Pay monthly'), panel('y', 'Yearly', 'Pay yearly')]);

    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument();
  });

  it('opens the first panel and switches on click', async () => {
    const user = userEvent.setup();
    renderTabs([panel('m', 'Monthly', 'Pay monthly'), panel('y', 'Yearly', 'Pay yearly')]);

    expect(screen.getByText('Pay monthly')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Yearly' }));

    expect(screen.getByText('Pay yearly')).toBeInTheDocument();
  });

  /*
    The regression that shipped once.

    An empty slot on the CANVAS renders a drop placeholder, which is a valid
    React element. A forgiving reader turned it into a tab called "Tab 1" that
    existed while editing and vanished when published — a tab strip that
    disagrees with its own page.
  */
  it('ignores a child that is not a real panel', () => {
    renderTabs(<div data-testid="canvas-placeholder">default</div>);

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    /* The placeholder is still rendered, so the canvas can be dropped into. */
    expect(screen.getByTestId('canvas-placeholder')).toBeInTheDocument();
  });

  it('pairs every trigger with its panel for assistive technology', () => {
    renderTabs([panel('m', 'Monthly', 'Pay monthly')]);

    const tab = screen.getByRole('tab', { name: 'Monthly' });
    const shown = screen.getByRole('tabpanel');

    expect(tab).toHaveAttribute('aria-controls', shown.id);
    expect(shown).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('schema: accepts panels and nothing else, because a tab needs a label', () => {
    expect(tabsSchema.slots?.['default']?.allow).toEqual(['tabPanel']);
  });

  it('schema: a panel takes real content', () => {
    expect(tabPanelSchema.slots?.['default']?.allow).toContain('pricing');
    expect(tabPanelSchema.inlineEditable).toBe('label');
  });
});
