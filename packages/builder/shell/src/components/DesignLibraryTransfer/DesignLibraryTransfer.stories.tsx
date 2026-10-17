import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createDesignTestKernel } from '../DesignSystemPanel/design-test-site';
import { DesignLibraryTransfer } from './DesignLibraryTransfer';
import { DESIGN_LIBRARY_TRANSFER_LABELS_AR } from './DesignLibraryTransfer.labels';

interface DemoProps {
  readonly arabic: boolean;
}

function Demo({ arabic }: DemoProps) {
  const kernel = useMemo(
    () =>
      createDesignTestKernel({
        library: {
          palette: [{ id: 'sand', name: 'Sand', value: '#e7d8b8' }],
          fonts: [{ family: 'Cairo', source: 'google', weights: [400, 700] }],
        },
      }),
    [],
  );
  return (
    <DesignLibraryTransfer
      site={kernel}
      onDownload={() => undefined}
      {...(arabic ? { labels: DESIGN_LIBRARY_TRANSFER_LABELS_AR, dir: 'rtl' as const } : {})}
    />
  );
}

const meta = {
  title: 'Builder/Shell/DesignSystem/DesignLibraryTransfer',
  component: Demo,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '24rem' }}>
        <Story />
      </div>
    ),
  ],
  args: { arabic: false },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Arabic: Story = { args: { arabic: true } };
