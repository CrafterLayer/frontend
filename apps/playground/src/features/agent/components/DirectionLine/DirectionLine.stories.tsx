import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import type { Locale } from '../../model/view-types';
import { DIRECTION, DIRECTION_PROSE } from '../../testing/wp-12-records-fixtures';

import { DirectionLine } from './DirectionLine';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. The line sits in a record's text column, 24px in.
 */
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
          padding: 'var(--bldr-space-3xl)',
          paddingInlineStart: 'calc(var(--bldr-space-3xl) + var(--bldr-space-5xl))',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

async function expectOneLine(canvasElement: HTMLElement): Promise<void> {
  const line = canvasElement.querySelector('.ck-agent-direction__visual');
  if (line === null) throw new Error('no line');
  await expect(line.getBoundingClientRect().height).toBeLessThanOrEqual(20);
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

const meta = {
  title: 'Agent/Records/DirectionLine',
  component: DirectionLine,
  parameters: { layout: 'centered' },
  args: { locale: 'en', direction: DIRECTION.en },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof DirectionLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five swatches, the mood; the fonts wait for 400px. */
export const Full: Story = {
  play: async ({ canvasElement }) => {
    await expectOneLine(canvasElement);
    const fonts = canvasElement.querySelector('.ck-agent-direction__fonts');
    if (fonts === null) throw new Error('no fonts');
    await expect(getComputedStyle(fonts).display).toBe('none');
  },
};

/** From 400px the font pair joins the line, in Slate, at the inline end. */
export const At420: Story = {
  parameters: { panel: { width: 420 } },
  play: async ({ canvasElement }) => {
    await expectOneLine(canvasElement);
    const fonts = canvasElement.querySelector('.ck-agent-direction__fonts');
    if (fonts === null) throw new Error('no fonts');
    await expect(getComputedStyle(fonts).display).not.toBe('none');
  },
};

/** Before structured direction (SPEC §7.6 E7): the prose on one line, ending in an ellipsis. */
export const ProseOnly: Story = {
  args: { direction: DIRECTION_PROSE.en },
  play: async ({ canvasElement }) => {
    await expectOneLine(canvasElement);
  },
};

export const Dark: Story = { parameters: { panel: { theme: 'dark', width: 420 } } };

/** Arabic: the swatches follow the reading direction, background first at the right. */
export const RightToLeft: Story = {
  args: { locale: 'ar', direction: DIRECTION.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const [first, second] = [
      ...canvasElement.querySelectorAll('.ck-agent-direction__swatch'),
    ].map((swatch) => swatch.getBoundingClientRect());
    if (first === undefined || second === undefined) throw new Error('no swatches');
    await expect(first.left).toBeGreaterThan(second.left);
  },
};

export const RightToLeftAt420Dark: Story = {
  args: { locale: 'ar', direction: DIRECTION.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420, theme: 'dark' } },
};

export const ProseOnlyRightToLeft: Story = {
  args: { locale: 'ar', direction: DIRECTION_PROSE.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};
