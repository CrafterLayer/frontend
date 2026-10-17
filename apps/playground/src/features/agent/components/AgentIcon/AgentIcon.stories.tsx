import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import type { Locale } from '../../model/view-types';

import { AgentIcon } from './AgentIcon';
import { AGENT_ICON_NAMES, ICONS } from './icon-paths';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. A story picks its frame with
 * `parameters.panel`; a story-level decorator would nest a second frame inside this one.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 420 } = (parameters['panel'] ?? {}) as Frame;
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
        }}
      >
        <Story />
      </div>
    </div>
  );
};

/* ── The gallery ──────────────────────────────────────────────────────────── */

/**
 * Every glyph at 1:1 and at 3:1 on the 16px grid, named by its key. The names are the
 * code's identifiers, not panel copy.
 */
function Gallery() {
  return (
    <ul
      aria-label="Agent icons"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
        gap: 'var(--bldr-space-md)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {AGENT_ICON_NAMES.map((name) => (
        <li
          key={name}
          data-name={name}
          style={{
            display: 'grid',
            justifyItems: 'center',
            gap: 'var(--bldr-space-xs)',
            padding: 'var(--bldr-space-md)',
            borderRadius: 'var(--bldr-radius-sm)',
            background: 'var(--bldr-surface)',
            color: 'var(--bldr-panel-text)',
          }}
        >
          <AgentIcon name={name} />
          <span
            style={{
              scale: '3',
              margin: 'var(--bldr-space-3xl)',
              color: 'var(--bldr-panel-text-soft)',
            }}
          >
            <AgentIcon name={name} />
          </span>
          <code
            lang="en"
            dir="ltr"
            style={{
              color: 'var(--bldr-panel-text-soft)',
              fontSize: 'var(--bldr-font-size-figure)',
              lineHeight: 'var(--bldr-line-height-figure)',
            }}
          >
            {name}
            {ICONS[name].mirror ? ' ⇄' : ''}
          </code>
        </li>
      ))}
    </ul>
  );
}

/** Every glyph's geometry stays inside the 16px box's live area. */
async function expectOnGrid(canvas: HTMLElement): Promise<void> {
  for (const svg of canvas.querySelectorAll<SVGSVGElement>('li > svg.ck-agent-icon')) {
    const box = svg.getBBox();
    const name = svg.dataset['icon'] ?? '';
    await expect(box.x, `${name} x`).toBeGreaterThanOrEqual(1.25);
    await expect(box.y, `${name} y`).toBeGreaterThanOrEqual(1.25);
    await expect(box.x + box.width, `${name} x end`).toBeLessThanOrEqual(14.75);
    await expect(box.y + box.height, `${name} y end`).toBeLessThanOrEqual(14.75);
  }
}

/** In RTL exactly the directional glyphs flip, through the `scale` property. */
async function expectMirroring(canvas: HTMLElement, rtl: boolean): Promise<void> {
  for (const svg of canvas.querySelectorAll<SVGSVGElement>('li > svg.ck-agent-icon')) {
    const name = svg.dataset['icon'] ?? '';
    const flipped = getComputedStyle(svg).scale === '-1 1';
    await expect({ name, flipped }).toEqual({
      name,
      flipped: rtl && svg.hasAttribute('data-mirror'),
    });
  }
}

const meta = {
  title: 'Agent/Primitives/AgentIcon',
  component: AgentIcon,
  parameters: { layout: 'centered' },
  args: { name: 'send' },
  argTypes: {
    name: { control: 'select', options: AGENT_ICON_NAMES },
  },
  decorators: [inPanel],
} satisfies Meta<typeof AgentIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One glyph, as a component uses it. */
export const Single: Story = {};

export const Light: Story = {
  render: () => <Gallery />,
  play: async ({ canvasElement }) => {
    await expectOnGrid(canvasElement);
    await expectMirroring(canvasElement, false);
  },
};

export const Dark: Story = {
  render: () => <Gallery />,
  parameters: { panel: { theme: 'dark' } },
};

/** Right to left: the directional glyphs (⇄) point the other way; send, stop, the clock do not. */
export const RightToLeft: Story = {
  render: () => <Gallery />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectMirroring(canvasElement, true);
  },
};

export const RightToLeftDark: Story = {
  render: () => <Gallery />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expectMirroring(canvasElement, true);
  },
};

/** A Latin island inside the Arabic panel keeps its arrows pointing right. */
export const LatinIslandInArabic: Story = {
  render: () => (
    <p style={{ display: 'flex', gap: 'var(--bldr-space-md)', margin: 0 }}>
      <AgentIcon name="arrowEnd" />
      <span dir="ltr" lang="en" style={{ display: 'inline-flex', gap: 'var(--bldr-space-md)' }}>
        <AgentIcon name="arrowEnd" />
      </span>
    </p>
  ),
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 320 } },
  play: async ({ canvasElement }) => {
    const [arabic, latin] = canvasElement.querySelectorAll<SVGSVGElement>(
      'svg[data-icon="arrowEnd"]',
    );
    if (arabic === undefined || latin === undefined) throw new Error('two arrows expected');
    await expect(getComputedStyle(arabic).scale).toBe('-1 1');
    await expect(getComputedStyle(latin).scale).toBe('none');
  },
};
