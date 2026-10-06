import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { setUtilityClassOracle, type SiteLibrary } from '@craftkit/builder-schema';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { ClassManager } from './ClassManager';
import { CLASS_MANAGER_LABELS_AR } from './ClassManager.labels';

/* Storybook has no live compiler; every class counts as real here. */
setUtilityClassOracle(() => true);

const LIBRARY: SiteLibrary = {
  styles: {
    card: { id: 'card', name: 'Card', className: 'rounded-xl p-6 shadow-lg bg-surface' },
    'card-featured': { id: 'card-featured', name: 'Card featured', className: 'ring-2 ring-accent' },
    pill: { id: 'pill', name: 'Pill', className: 'rounded-full px-4 py-1' },
  },
};

interface DemoProps {
  readonly selected: boolean;
  readonly arabic: boolean;
}

function Demo({ selected, arabic }: DemoProps) {
  const kernel = useMemo(() => createDesignTestKernel({ library: LIBRARY }), []);
  return (
    <ClassManager
      site={kernel}
      target={selected ? { kind: 'tree', nodeId: 'region', path: [0, 1] } : undefined}
      {...(arabic ? { labels: CLASS_MANAGER_LABELS_AR, dir: 'rtl' as const } : {})}
    />
  );
}

const meta = {
  title: 'Builder/Shell/DesignSystem/ClassManager',
  component: Demo,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '24rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { selected: true, arabic: false },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ElementSelected: Story = {};
export const NothingSelected: Story = { args: { selected: false } };
export const Arabic: Story = { args: { arabic: true } };
