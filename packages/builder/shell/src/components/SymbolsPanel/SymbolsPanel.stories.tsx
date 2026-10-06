import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SiteLibrary } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { SymbolsPanel } from './SymbolsPanel';
import { SYMBOLS_PANEL_LABELS_AR } from './SymbolsPanel.labels';

const LIBRARY: SiteLibrary = {
  symbols: {
    banner: {
      id: 'banner',
      name: 'Banner',
      tree: {
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            className: 'p-8',
            children: [
              { kind: 'element', tag: 'h2', text: 'Summer sale' },
              { kind: 'element', tag: 'p', text: 'Ends Friday' },
            ],
          },
        ],
      },
    },
  },
};

interface DemoProps {
  readonly selection: 'region' | 'inst' | 'none';
  readonly arabic: boolean;
}

function Demo({ selection, arabic }: DemoProps) {
  const kernel = useMemo(
    () =>
      createDesignTestKernel({
        library: LIBRARY,
        extraNodes: {
          inst: {
            id: 'inst',
            type: 'customCodeSymbol',
            props: { label: 'Banner', symbolId: 'banner', overrides: [{ path: [0, 0], text: 'Mine' }] },
          },
        },
      }),
    [],
  );
  return (
    <SymbolsPanel
      site={kernel}
      nodeId={selection === 'none' ? undefined : selection}
      {...(arabic ? { labels: SYMBOLS_PANEL_LABELS_AR, dir: 'rtl' as const } : {})}
    />
  );
}

const meta = {
  title: 'Builder/Shell/DesignSystem/SymbolsPanel',
  component: Demo,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '24rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { selection: 'inst', arabic: false },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InstanceSelected: Story = {};
export const RegionSelected: Story = { args: { selection: 'region' } };
export const LibraryOnly: Story = { args: { selection: 'none' } };
export const Arabic: Story = { args: { arabic: true } };
