import { useMemo, useState } from 'react';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleBucket, StyleIntent, StyleState } from '@craftkit/builder-schema';
import { applyStyleIntents } from '@craftkit/builder-schema';

import type { StyleSource } from '../style-source';
import { StylePanel, type StylePanelProps } from './StylePanel';
import { STYLE_PANEL_LABELS_AR } from './StylePanel.labels';

/** A story-only source over one class string held in React state. */
function useMemorySource(initial: string, mode: 'free' | 'tokens'): StyleSource {
  const [className, setClassName] = useState(initial);
  return useMemo<StyleSource>(
    () => ({
      id: 'story',
      label: 'Heading “Our story”',
      mode,
      targetCount: 1,
      read: () => [className],
      apply: (intents: readonly StyleIntent[]) => {
        const result = applyStyleIntents(className, intents, { mode });
        if (!result.ok) return result;
        setClassName(result.className);
        return { ok: true };
      },
      subscribe: () => () => undefined,
    }),
    [className, mode],
  );
}

function Playground(props: StylePanelProps & { readonly initial: string }) {
  const source = useMemorySource(props.initial, props.source.mode);
  const [bucket, setBucket] = useState<StyleBucket>('base');
  const [state, setState] = useState<StyleState>('default');
  return (
    <StylePanel
      {...props}
      source={source}
      bucket={bucket}
      state={state}
      onBucketChange={setBucket}
      onStateChange={setState}
    />
  );
}

const tokens = [
  { id: 'surface', name: 'Surface', css: '#ffffff' },
  { id: 'text', name: 'Text', css: '#111827' },
  { id: 'text-muted', name: 'Muted text', css: '#9ca3af' },
  { id: 'accent', name: 'Accent', css: '#2563eb' },
];

const placeholder: StyleSource = {
  id: 'placeholder',
  label: 'Element',
  mode: 'free',
  targetCount: 1,
  read: () => [''],
  apply: () => ({ ok: true }),
  subscribe: () => () => undefined,
};

const meta = {
  title: 'Builder/Shell/StyleManager/StylePanel',
  component: StylePanel,
  render: (args) => <Playground {...args} initial="flex flex-col gap-4 p-6 text-lg text-text bg-surface rounded-lg shadow-soft" />,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '22rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    source: placeholder,
    bucket: 'base',
    state: 'default',
    dir: 'ltr',
    tokens,
    palette: [{ id: 'brand-600', name: 'Brand 600', css: '#0f766e' }],
    announce: fn(),
  },
} satisfies Meta<typeof StylePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeMode: Story = {};
export const TokensMode: Story = { args: { source: { ...placeholder, mode: 'tokens' } } };
export const ArabicPage: Story = { args: { dir: 'rtl', labels: STYLE_PANEL_LABELS_AR } };
