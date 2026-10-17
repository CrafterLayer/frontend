import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { defaultDesignSystem, type SiteLibrary } from '@craftkit/builder-schema';

import { DesignSystemPanel, type DesignSystemPanelProps } from './DesignSystemPanel';
import { DESIGN_SYSTEM_PANEL_LABELS_AR } from './DesignSystemPanel.labels';
import { FONT_PICKER_LABELS_AR } from '../FontPicker/FontPicker.labels';
import { PALETTE_RAMP_EDITOR_LABELS_AR } from '../PaletteRampEditor/PaletteRampEditor.labels';

const LIBRARY: SiteLibrary = {
  palette: [
    { id: 'sand', name: 'Sand', value: '#e7d8b8' },
    { id: 'ink', name: 'Ink', value: 'oklch(25% 0.03 260)' },
  ],
  fonts: [{ family: 'Cairo', source: 'google', weights: [400, 700], scripts: ['arabic', 'latin'] }],
};

function Controlled(props: DesignSystemPanelProps) {
  const [system, setSystem] = useState(props.system);
  return (
    <DesignSystemPanel
      {...props}
      system={system}
      onChangeToken={(token, value) => {
        setSystem((current) => ({ ...current, tokens: { ...current.tokens, [token]: value } }));
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/DesignSystemPanel',
  component: DesignSystemPanel,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '26rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    system: defaultDesignSystem(),
    onChangeToken: () => undefined,
    onRegenerate: () => undefined,
  },
} satisfies Meta<typeof DesignSystemPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TokensOnly: Story = {};
export const WithLibrary: Story = {
  args: { library: LIBRARY, onCommit: () => ({ ok: true }) },
};
export const Typography: Story = {
  args: { library: LIBRARY, onCommit: () => ({ ok: true }), defaultSection: 'typography' },
};
export const RadiusAndShadows: Story = { args: { defaultSection: 'shape' } };
export const SpacingAndWidths: Story = { args: { defaultSection: 'spacing' } };
export const Refused: Story = {
  args: { issues: ['"accent" on "surface" measures 1.23:1, below the 4.5:1 this text needs.'] },
};
export const Arabic: Story = {
  args: {
    library: LIBRARY,
    onCommit: () => ({ ok: true }),
    labels: DESIGN_SYSTEM_PANEL_LABELS_AR,
    fontLabels: FONT_PICKER_LABELS_AR,
    rampLabels: PALETTE_RAMP_EDITOR_LABELS_AR,
    dir: 'rtl',
  },
};
