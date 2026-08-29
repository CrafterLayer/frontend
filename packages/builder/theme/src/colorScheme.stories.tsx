import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import './css/chrome.css';

function ColorSchemeProbe() {
  return (
    <div style={{ display: 'grid', gap: '16px', padding: '24px' }}>
      {(['light', 'dark'] as const).map((theme) => (
        <section
          className="bldr-root"
          data-bldr-theme={theme}
          data-testid={`${theme}-theme-root`}
          key={theme}
          style={{
            background: 'var(--bldr-panel)',
            border: '1px solid var(--bldr-panel-border)',
            borderRadius: 'var(--bldr-radius-md)',
            color: 'var(--bldr-panel-text)',
            padding: '16px',
          }}
        >
          <label>
            <input data-testid={`${theme}-checkbox`} defaultChecked type="checkbox" /> {theme}{' '}
            native checkbox
          </label>
        </section>
      ))}
    </div>
  );
}

function colorScheme(element: Element): string {
  return getComputedStyle(element).getPropertyValue('color-scheme').trim();
}

function requiredElement(container: ParentNode, testId: string): Element {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`Missing color-scheme probe: ${testId}`);
  }
  return element;
}

const meta = {
  title: 'Builder/Theme/Native color scheme',
  component: ColorSchemeProbe,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ColorSchemeProbe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NativeControlsFollowTheTheme: Story = {
  play: async ({ canvasElement }) => {
    const light = colorScheme(requiredElement(canvasElement, 'light-theme-root'));
    const dark = colorScheme(requiredElement(canvasElement, 'dark-theme-root'));
    const nativeDark = colorScheme(requiredElement(canvasElement, 'dark-checkbox'));

    await expect(light).toBe('light');
    await expect(dark).toBe('dark');
    await expect(nativeDark).toBe('dark');
    // Non-vacuous: this must fail if the selector never responds to the theme.
    await expect(light).not.toBe(dark);
  },
};
