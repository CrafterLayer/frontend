import { useMemo, useState } from 'react';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import type { StyleBucket, StyleIntent, StyleSectorId, StyleState } from '@craftkit/builder-schema';
import { applyStyleIntents } from '@craftkit/builder-schema';

import type { StyleSource } from '../style-source';
import { StylePanel, type StylePanelProps } from './StylePanel';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN } from './StylePanel.labels';

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
    (Story, context) =>
      context.parameters['matrix'] === true ? (
        <Story />
      ) : (
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

export const ArabicDark: Story = {
  args: { dir: 'rtl', labels: STYLE_PANEL_LABELS_AR },
  parameters: { matrix: true },
  decorators: [
    (Story) => (
      <div
        className="bldr-root"
        data-bldr-theme="dark"
        dir="rtl"
        style={{ background: 'var(--bldr-panel)', maxInlineSize: '22rem', padding: '1rem' }}
      >
        <Story />
      </div>
    ),
  ],
};

/*
  One story per sector, each drawing the sector four times: light and dark,
  English (LTR page) and Arabic (RTL page) — the panel-design acceptance grid.
*/
const VARIANTS = [
  { theme: 'light', locale: 'en' },
  { theme: 'dark', locale: 'en' },
  { theme: 'light', locale: 'ar' },
  { theme: 'dark', locale: 'ar' },
] as const;

const SECTOR_CLASSES =
  'flex flex-col items-center justify-between gap-4 p-6 mbs-2 inline-full max-inline-2xl relative z-10 ' +
  'text-lg font-semibold leading-snug text-text text-center bg-surface bg-linear-to-be from-accent ' +
  'border-2 border-solid border-accent rounded-lg shadow-soft opacity-90 rotate-3 transition-colors duration-300';

function SectorMatrix({ sector, ...props }: StylePanelProps & { readonly sector: StyleSectorId }) {
  return (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {VARIANTS.map(({ theme, locale }) => (
        <div
          key={`${theme}-${locale}`}
          className="bldr-root"
          data-bldr-theme={theme}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          style={{ background: 'var(--bldr-panel)', color: 'var(--bldr-panel-text)', inlineSize: '320px', padding: '12px' }}
        >
          <Playground
            {...props}
            initial={SECTOR_CLASSES}
            sectors={[sector]}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            labels={locale === 'ar' ? STYLE_PANEL_LABELS_AR : STYLE_PANEL_LABELS_EN}
          />
        </div>
      ))}
    </div>
  );
}

const sectorStory = (sector: StyleSectorId): Story => ({
  render: (args) => <SectorMatrix {...args} sector={sector} />,
  parameters: { layout: 'fullscreen', matrix: true },
});

export const LayoutSector = sectorStory('layout');
export const SpacingSector = sectorStory('spacing');
export const SizeSector = sectorStory('size');
export const PositionSector = sectorStory('position');
export const TypographySector = sectorStory('typography');
export const BackgroundsSector = sectorStory('backgrounds');
export const BordersSector = sectorStory('borders');
export const EffectsSector = sectorStory('effects');
export const TransformsSector = sectorStory('transforms');
export const TransitionsSector = sectorStory('transitions');
