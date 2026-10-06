import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScenePresetPicker, type ScenePatch, type ScenePresetPickerProps } from './ScenePresetPicker';
import { SCENE_PRESET_PICKER_LABELS_AR } from './ScenePresetPicker.labels';

function Controlled(props: ScenePresetPickerProps) {
  const [attributes, setAttributes] = useState(props.attributes);
  return (
    <ScenePresetPicker
      {...props}
      attributes={attributes}
      onCommit={(patch: ScenePatch) => {
        const next: Record<string, string | undefined> = { ...attributes };
        for (const [name, value] of Object.entries(patch)) next[name] = value ?? undefined;
        setAttributes(next);
      }}
    />
  );
}

const meta = {
  title: 'Builder/Shell/StyleManager/ScenePresetPicker',
  component: ScenePresetPicker,
  render: (args) => <Controlled {...args} />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    attributes: { 'data-ck-scene': 'particles', 'data-ck-density': 'medium', 'data-ck-palette': 'theme' },
    imageCount: 2,
    onCommit: () => undefined,
    dir: 'ltr',
  },
} satisfies Meta<typeof ScenePresetPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** English, left to right, on a layer with two images. */
export const EnglishLtr: Story = {};
/** Arabic, right to left: a mural layer. */
export const ArabicRtl: Story = {
  args: {
    attributes: { 'data-ck-scene': 'mural', 'data-ck-density': 'low', 'data-ck-palette': 'accent' },
    dir: 'rtl',
    labels: SCENE_PRESET_PICKER_LABELS_AR,
  },
};
/** No images in the layer: the image scenes say they need one. */
export const WithoutImages: Story = { args: { imageCount: 0 } };
