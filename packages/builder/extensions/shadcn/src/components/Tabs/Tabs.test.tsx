import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { DocumentView, StaticDocument } from '@craftkit/builder-renderer';
import {
  LATEST_SCHEMA_VERSION,
  type BlockSlotChildMetadata,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { TabPanel } from '../TabPanel/TabPanel';
import { tabPanelSchema } from '../TabPanel/schema';

import { Tabs } from './Tabs';
import { tabsSchema } from './schema';

afterEach(cleanup);

const node = { id: 'tabs-1', type: 'tabs', props: {} };

const metadata = (id: string, label: string): BlockSlotChildMetadata => ({
  id,
  type: 'tabPanel',
  props: { label },
});

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

const renderTabs = (
  children: React.ReactNode,
  overrides: Record<string, unknown> = {},
  childrenMetadata: readonly BlockSlotChildMetadata[] = [],
) =>
  render(
    <Tabs
      node={node}
      props={tabsSchema.props.parse(overrides)}
      slots={{ default: children }}
      slotChildren={{ default: childrenMetadata }}
      data={{}}
      isCanvas={false}
    />,
  );

const tabsIntegrationManifest: TrustedExtensionManifest = {
  tier: 1,
  name: 'tabs-integration',
  version: '0.0.1',
  contributes: {
    blocks: [
      { schema: tabsSchema, render: Tabs },
      { schema: tabPanelSchema, render: TabPanel },
    ],
  },
};

function tabsDocument(): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'tabs-1',
    nodes: {
      'tabs-1': {
        id: 'tabs-1',
        type: 'tabs',
        props: {},
        slots: { default: ['monthly', 'yearly'] },
      },
      monthly: { id: 'monthly', type: 'tabPanel', props: { label: 'Monthly' } },
      yearly: { id: 'yearly', type: 'tabPanel', props: { label: 'Yearly' } },
    },
  };
}

describe('Tabs', () => {
  it('builds one trigger per panel, named by the panel', () => {
    renderTabs([panel('m', 'Monthly', 'Pay monthly'), panel('y', 'Yearly', 'Pay yearly')], {}, [
      metadata('m', 'Monthly'),
      metadata('y', 'Yearly'),
    ]);

    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument();
  });

  it('uses metadata rather than deriving labels from canvas wrappers', () => {
    renderTabs(
      <div data-bldr-slot="default">
        <div data-bldr-node="m">{panel('m', 'Monthly', 'Pay monthly')}</div>
        <div data-bldr-node="y">{panel('y', 'Yearly', 'Pay yearly')}</div>
      </div>,
      {},
      [metadata('m', 'Monthly'), metadata('y', 'Yearly')],
    );

    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument();
  });

  it('receives identical document metadata from live and static renderers', () => {
    const kernel = createBuilder({
      document: tabsDocument(),
      extensions: [tabsIntegrationManifest],
      ports: { clock: fixedClock(), ids: seededIds('tabs') },
    });
    const live = render(<DocumentView kernel={kernel} />);

    expect(screen.getByRole('tab', { name: 'Monthly' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument();

    act(() => {
      kernel.dispatch('setProp', { id: 'monthly', key: 'label', value: 'Monthly billing' });
    });
    expect(screen.getByRole('tab', { name: 'Monthly billing' })).toBeInTheDocument();

    live.unmount();
    render(
      <StaticDocument
        document={kernel.getDocument() as BuilderDocument}
        blocks={kernel.context.registry.block}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Monthly billing' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument();
  });

  it('opens the first panel and switches on click', async () => {
    const user = userEvent.setup();
    renderTabs([panel('m', 'Monthly', 'Pay monthly'), panel('y', 'Yearly', 'Pay yearly')], {}, [
      metadata('m', 'Monthly'),
      metadata('y', 'Yearly'),
    ]);

    expect(screen.getByText('Pay monthly')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Yearly' }));

    expect(screen.getByText('Pay yearly')).toBeInTheDocument();
  });

  it('falls back to the first remaining panel when the selected panel is removed', async () => {
    const user = userEvent.setup();
    const initialChildren = [
      panel('m', 'Monthly', 'Pay monthly'),
      panel('y', 'Yearly', 'Pay yearly'),
    ];
    const { rerender } = render(
      <Tabs
        node={node}
        props={tabsSchema.props.parse({})}
        slots={{ default: initialChildren }}
        slotChildren={{ default: [metadata('m', 'Monthly'), metadata('y', 'Yearly')] }}
        data={{}}
        isCanvas={false}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Yearly' }));
    expect(screen.getByText('Pay yearly')).toBeVisible();

    rerender(
      <Tabs
        node={node}
        props={tabsSchema.props.parse({})}
        slots={{ default: panel('m', 'Monthly', 'Pay monthly') }}
        slotChildren={{ default: [metadata('m', 'Monthly')] }}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Monthly' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Pay monthly')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Yearly' })).not.toBeInTheDocument();
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
    renderTabs([panel('m', 'Monthly', 'Pay monthly')], {}, [metadata('m', 'Monthly')]);

    const tab = screen.getByRole('tab', { name: 'Monthly' });
    const shown = screen.getByRole('tabpanel');

    expect(tab).toHaveAttribute('aria-controls', shown.id);
    expect(shown).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('schema: accepts panels and nothing else, because a tab needs a label', () => {
    expect(tabsSchema.slots?.['default']?.allow).toEqual(['tabPanel']);
    expect(tabsSchema.slots?.['default']?.exposeChildMetadata).toBe(true);
  });

  it('schema: a panel takes real content', () => {
    expect(tabPanelSchema.slots?.['default']?.allow).toContain('pricing');
    expect(tabPanelSchema.inlineEditable).toBe('label');
  });
});

// ── block-parts (2026-10-06) ──
describe('Tabs — each trigger is its panel\'s label part (fix pass)', () => {
  const panels = [metadata('panel-a', 'Overview'), metadata('panel-b', 'Pricing')];
  const children = [panel('panel-a', 'Overview', 'A body'), panel('panel-b', 'Pricing', 'B body')];

  it('on the canvas, stamps each trigger with the label part, its bind and the owning panel', () => {
    render(
      <Tabs
        node={node}
        props={tabsSchema.props.parse({})}
        slots={{ default: children }}
        slotChildren={{ default: panels }}
        data={{}}
        isCanvas
      />,
    );
    const trigger = screen.getByRole('tab', { name: 'Pricing' });
    expect(trigger).toHaveAttribute('data-ck-part', 'label');
    expect(trigger).toHaveAttribute('data-ck-bind', 'label');
    expect(trigger).toHaveAttribute('data-ck-part-owner', 'panel-b');
    expect(trigger).toHaveAttribute('dir', 'auto');
  });

  it('applies the panel\'s own label part styles to its trigger', () => {
    render(
      <Tabs
        node={node}
        props={tabsSchema.props.parse({})}
        slots={{ default: children }}
        slotChildren={{
          default: [
            panels[0] ?? metadata('panel-a', 'Overview'),
            { id: 'panel-b', type: 'tabPanel', props: { label: 'Pricing', partStyles: { label: { className: 'ps-4', dir: 'ltr' } } } },
          ],
        }}
        data={{}}
        isCanvas={false}
      />,
    );
    const trigger = screen.getByRole('tab', { name: 'Pricing' });
    expect(trigger).toHaveClass('ps-4');
    expect(trigger).toHaveAttribute('dir', 'ltr');
  });

  it('publishes no canvas stamp', () => {
    renderTabs(children, {}, panels);
    for (const trigger of screen.getAllByRole('tab')) {
      expect(trigger).not.toHaveAttribute('data-ck-part');
      expect(trigger).not.toHaveAttribute('data-ck-part-owner');
    }
  });
});
// ── /block-parts ──
