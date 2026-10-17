import * as RadixTabs from '@radix-ui/react-tabs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { partInstances } from '@craftkit/builder-schema';

import { TabPanel } from './TabPanel';
import { tabPanelSchema } from './schema';

/*
  Block parts (block-parts DESIGN §4.3). A panel's label is DRAWN by the parent
  Tabs block as the panel's trigger, so the panel declares the part (the
  Inspector, Layers and the agent address it) but stamps no element for it,
  and the panel's own root stays the block so a click on it selects the panel.
*/
function renderPanel(overrides: Record<string, unknown>, isCanvas: boolean) {
  const id = 'panel-parts';
  return render(
    <RadixTabs.Root defaultValue={id}>
      <TabPanel
        node={{ id, type: 'tabPanel', props: {} }}
        props={tabPanelSchema.props.parse(overrides)}
        slots={{ default: <p>Pay monthly</p> }}
        data={{}}
        isCanvas={isCanvas}
      />
    </RadixTabs.Root>,
  );
}

describe('TabPanel parts', () => {
  it('declares its label as a text part bound to the label prop', () => {
    const parts = tabPanelSchema.parts ?? {};
    expect(parts['label']).toMatchObject({ kind: 'text', bind: 'label' });
    expect(partInstances(parts, tabPanelSchema.props.parse({ label: 'Monthly' }))).toEqual([
      expect.objectContaining({ part: 'label', index: [], bind: 'label' }),
    ]);
  });

  it('stamps no part marker on the panel root, on the canvas or published', () => {
    const { container, unmount } = renderPanel({ label: 'Monthly' }, true);
    expect(container.querySelector('[data-ck-part],[data-ck-bind]')).toBeNull();
    unmount();
    const published = renderPanel({ label: 'Monthly' }, false);
    expect(published.container.querySelector('[data-ck-part],[data-ck-bind]')).toBeNull();
  });

  it('accepts part styles under the tokens law', () => {
    expect(
      tabPanelSchema.props.safeParse({ partStyles: { label: { className: 'ps-4', dir: 'rtl' } } })
        .success,
    ).toBe(true);
    expect(
      tabPanelSchema.props.safeParse({ partStyles: { label: { className: 'text-red-500' } } })
        .success,
    ).toBe(false);
  });
});
