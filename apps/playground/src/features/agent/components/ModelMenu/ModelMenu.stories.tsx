import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import { modelSelection } from '../../model/model-label';
import type { Locale, ModelSelectionView } from '../../model/view-types';
import { MODEL, MODEL_IDS } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { ModelMenu } from './ModelMenu';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root, with the trigger at the foot so the menu opens upwards. */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          minBlockSize: 280,
          padding: 'var(--bldr-space-md) var(--bldr-space-3xl) var(--bldr-space-3xl)',
        }}
      >
        <AgentTooltipProvider>
          <Story />
        </AgentTooltipProvider>
      </div>
    </div>
  );
};

function selected(id: string): ModelSelectionView {
  const selection = modelSelection(MODEL_IDS, id);
  if (selection === null) throw new Error('the fixture ids must offer a choice');
  return selection;
}

/** Opens the menu and returns its items. */
async function open(canvasElement: HTMLElement, name: string): Promise<HTMLElement[]> {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name }));
  const menu = await canvas.findByRole('menu');
  return within(menu).getAllByRole('menuitemradio');
}

const meta = {
  title: 'Agent/Composer/ModelMenu',
  component: ModelMenu,
  parameters: { layout: 'centered' },
  args: { locale: 'en', model: MODEL, onModelChange: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof ModelMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The trigger reads the tier, "Fast ▾", named "Model: Fast"; never `cli:haiku`. */
export const Fast: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Model: Fast' });
    await expect(trigger.textContent).not.toMatch(/cli:|\/|haiku/u);
  },
};

export const Careful: Story = { args: { model: selected('cli:sonnet') } };

export const Free: Story = { args: { model: selected('minimax/minimax-m3:free') } };

/**
 * Open: each model by tier, with its product name at the line's end in `<bdi>` and its
 * trait under it. No raw id anywhere in the menu.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const items = await open(canvasElement, 'Model: Fast');
    await expect(items).toHaveLength(3);
    for (const item of items) await expect(item.textContent).not.toMatch(/cli:|\/|:free/u);
    await expect(items[0]).toHaveTextContent('Haiku');
    await expect(items[2]).toHaveTextContent('MiniMax M3');
  },
};

export const OpenDark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, 'Model: Fast');
  },
};

/** Arabic: «سريع ▾»; the product names stay Latin, isolated in `<bdi>`. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const OpenRightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, t('ar', 'model.aria', { name: t('ar', 'model.fast') }));
  },
};

export const OpenRightToLeftDark: Story = {
  args: { locale: 'ar', model: selected('minimax/minimax-m3:free') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await open(canvasElement, t('ar', 'model.aria', { name: t('ar', 'model.free') }));
  },
};
