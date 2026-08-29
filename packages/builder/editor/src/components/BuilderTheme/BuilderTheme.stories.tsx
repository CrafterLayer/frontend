import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { darkChromeTheme, lightChromeTheme } from '@craftkit/builder-theme';

import { BuilderTheme } from './BuilderTheme';

/**
 * Every story renders the SAME sample chrome. Nothing below sets a colour: if a
 * swatch changes between stories, it changed because a token moved, which is
 * the only claim these stories are here to make.
 */
function SampleChrome() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--bldr-space-3xl)',
        padding: 'var(--bldr-space-5xl)',
        background: 'var(--bldr-ground)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        minBlockSize: '320px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bldr-space-xl)' }}>
        <div
          style={{
            inlineSize: 'var(--bldr-control-height)',
            blockSize: 'var(--bldr-control-height)',
            borderRadius: 'var(--bldr-radius-lg)',
            background: 'var(--bldr-rail)',
          }}
        />
        <span style={{ fontSize: 'var(--bldr-font-size-display)', fontWeight: 600 }}>
          CraftKit Builder
        </span>
        <button
          type="button"
          style={{
            marginInlineStart: 'auto',
            padding: '8px 16px',
            border: 0,
            borderRadius: 'var(--bldr-radius-md)',
            background: 'var(--bldr-accent)',
            color: 'var(--bldr-accent-text)',
            font: `600 var(--bldr-font-size-control)/1 var(--bldr-font)`,
            cursor: 'pointer',
          }}
        >
          Publish
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--bldr-space-lg)',
          padding: 'var(--bldr-space-2xl)',
          borderRadius: 'var(--bldr-radius-lg)',
          background: 'var(--bldr-panel)',
          border: '1px solid var(--bldr-panel-border)',
          boxShadow: 'var(--bldr-shadow-raised)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--bldr-font-size-caption)',
            color: 'var(--bldr-panel-muted)',
          }}
        >
          Size
        </span>
        <input
          aria-label="Size"
          defaultValue="56"
          style={{
            padding: '7px 9px',
            borderRadius: 'var(--bldr-radius-md)',
            border: '1px solid var(--bldr-panel-border-strong)',
            background: 'var(--bldr-input-bg)',
            color: 'var(--bldr-panel-text)',
            font: `500 var(--bldr-font-size-body)/1 var(--bldr-font-mono)`,
          }}
        />
        <div style={{ display: 'flex', gap: 'var(--bldr-space-md)' }}>
          {(['selection', 'danger', 'warning', 'success'] as const).map((token) => (
            <div
              key={token}
              data-testid={`swatch-${token}`}
              title={token}
              style={{
                inlineSize: '28px',
                blockSize: '28px',
                borderRadius: 'var(--bldr-radius-sm)',
                background: `var(--bldr-${token})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Builder/Preset/BuilderTheme',
  component: BuilderTheme,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BuilderTheme>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No `theme` prop: the operating system decides, which is the default state. */
export const FollowsTheSystem: Story = {
  args: { children: <SampleChrome /> },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('.bldr-root');
    await expect(root).not.toBe(null);
    await expect(root?.hasAttribute('data-bldr-theme')).toBe(false);
  },
};

export const Light: Story = {
  args: { theme: 'light', children: <SampleChrome /> },
  play: async ({ canvasElement }) => {
    // The tokens are not merely declared — they RESOLVE to a colour on screen.
    // A stylesheet that never reached the page would leave these empty.
    const swatch = within(canvasElement).getByTitle('selection');
    const painted = getComputedStyle(swatch).backgroundColor;
    await expect(painted).not.toBe('');
    await expect(painted).not.toBe('rgba(0, 0, 0, 0)');
  },
};

export const Dark: Story = {
  args: { theme: 'dark', children: <SampleChrome /> },
  play: async ({ canvasElement }) => {
    /*
      THE GATE THIS COMPONENT WAS MISSING.

      Its predecessor asserted the painted swatch was `not.toBe('')`, which is
      true of every colour there is — so it passed for as long as the dark
      theme did not work at all. In a real browser the attribute flipped to
      `dark` and every token stayed light, because the stylesheet keyed its
      explicit-choice blocks on `:root[…]` while this component stamps its OWN
      element. Nothing between the theme objects and the screen was ever read
      back from the browser, so nothing caught it.

      This reads the resolved custom property off the stamped element and
      compares it to the theme the component claims to be wearing.
    */
    const root = canvasElement.querySelector('.bldr-root');
    await expect(root).not.toBeNull();
    if (root === null) {
      throw new Error('BuilderTheme did not render its root');
    }
    await expect(root.getAttribute('data-bldr-theme')).toBe('dark');

    const resolved = (token: string) => getComputedStyle(root).getPropertyValue(token).trim();
    await expect(resolved('--bldr-panel')).toBe(darkChromeTheme.panel);
    await expect(resolved('--bldr-panel-text')).toBe(darkChromeTheme['panel-text']);
    await expect(resolved('--bldr-accent')).toBe(darkChromeTheme.accent);

    // Non-vacuous: the assertions above would also hold if the two themes were
    // the same object, and then they would prove nothing about switching.
    await expect(darkChromeTheme.panel).not.toBe(lightChromeTheme.panel);
    await expect(resolved('--bldr-panel')).not.toBe(lightChromeTheme.panel);
  },
};

export const Compact: Story = {
  args: { theme: 'light', density: 'compact', children: <SampleChrome /> },
};

/** A three-line re-brand: name what changes, inherit the rest. */
export const Rebranded: Story = {
  args: {
    theme: 'light',
    overrides: {
      accent: '#0f766e',
      'accent-text': '#ffffff',
      'accent-soft': '#ccfbf1',
      selection: '#0f766e',
    },
    children: <SampleChrome />,
  },
  play: async ({ canvasElement }) => {
    const swatch = within(canvasElement).getByTitle('selection');
    // The override reached the element, cascaded down, and won.
    await expect(getComputedStyle(swatch).backgroundColor).toBe('rgb(15, 118, 110)');
  },
};
