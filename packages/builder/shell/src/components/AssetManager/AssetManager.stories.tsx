import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { setUtilityClassOracle, type AssetEntry, type AssetLibraryPort } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { AssetManager } from './AssetManager';
import { ASSET_MANAGER_LABELS_AR } from './AssetManager.labels';

setUtilityClassOracle(() => true);

const svg = (fill: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${fill}"/></svg>`);

const entry = (id: string, fill: string, alt: string): AssetEntry => ({
  id,
  url: svg(fill),
  description: `Swatch ${id}`,
  mood: [],
  palette: [],
  alt,
  width: 400,
  height: 300,
});

const CATALOGUE: AssetLibraryPort = {
  list: () => Promise.resolve([entry('teal', '#0f766e', 'Teal field'), entry('sand', '#e7d8b8', 'Sand field')]),
};

interface DemoProps {
  readonly arabic: boolean;
  readonly selected: boolean;
}

function Demo({ arabic, selected }: DemoProps) {
  const kernel = useMemo(
    () =>
      createDesignTestKernel({
        assets: { slate: entry('slate', '#334155', ''), rose: entry('rose', '#e11d48', 'Rose field') },
      }),
    [],
  );
  return (
    <AssetManager
      site={kernel}
      library={CATALOGUE}
      target={selected ? { kind: 'tree', nodeId: 'region', path: [0, 0] } : undefined}
      {...(arabic ? { labels: ASSET_MANAGER_LABELS_AR, dir: 'rtl' as const } : {})}
    />
  );
}

const meta = {
  title: 'Builder/Shell/DesignSystem/AssetManager',
  component: Demo,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '26rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { arabic: false, selected: true },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NothingSelected: Story = { args: { selected: false } };
export const Arabic: Story = { args: { arabic: true } };
