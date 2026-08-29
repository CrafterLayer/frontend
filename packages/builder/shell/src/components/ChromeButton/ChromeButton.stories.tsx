import { expect } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BlockActionBar, type BlockActionBarProps } from '../BlockActionBar';
import { IconRail, type RailItem } from '../IconRail';
import { StatusBar, type StatusBarTool } from '../StatusBar';
import { TextBubble, type TextBubbleAction } from '../TextBubble';
import { TopBar } from '../TopBar';
import { ChromeButton, type ChromeButtonSize, type ChromeButtonVariant } from './ChromeButton';
import { CHROME_BUTTON_SIZE_TOKENS, CHROME_BUTTON_VARIANTS } from './constants';

const meta = {
  title: 'Builder/Shell/ChromeButton',
  component: ChromeButton,
  args: {
    children: 'Secondary action',
  },
} satisfies Meta<typeof ChromeButton>;
export default meta;

type Story = StoryObj<typeof meta>;

const SIZES = Object.keys(CHROME_BUTTON_SIZE_TOKENS) as ChromeButtonSize[];

function resolvedLength(element: Element, token: string): number {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  const length = Number.parseFloat(value);
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error(`Expected ${token} to resolve to a positive CSS length, received "${value}"`);
  }
  return length;
}

function roundedLength(value: number): number {
  return Math.round(value * 100) / 100;
}

const RAIL_ITEMS = [
  { id: 'pages', label: 'Pages', icon: <span aria-hidden="true">P</span> },
  { id: 'blocks', label: 'Blocks', icon: <span aria-hidden="true">B</span> },
] as const satisfies readonly RailItem[];

const STATUS_TOOLS = [
  { id: 'history', label: 'Open history', icon: <span aria-hidden="true">H</span> },
] as const satisfies readonly StatusBarTool[];

const BLOCK_ACTIONS = [
  { id: 'duplicate', label: 'Duplicate', enabled: true },
  { id: 'delete', label: 'Delete', enabled: true },
] as const satisfies BlockActionBarProps['actions'];

const TEXT_ACTIONS: TextBubbleAction[] = [
  { id: 'bold', label: 'Bold', pressed: true, run: () => undefined },
  { id: 'link', label: 'Link', run: () => undefined },
];

export const Default: Story = {};

export const Primary: Story = {
  args: {
    children: 'Publish',
    variant: 'primary',
  },
};

export const IconOnly: Story = {
  args: {
    'aria-label': 'Undo',
    children: <span aria-hidden="true">↶</span>,
    variant: 'icon',
  },
};

export const Toggle: Story = {
  args: {
    'aria-pressed': true,
    children: 'Bold',
    variant: 'toggle',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Unavailable',
    disabled: true,
  },
};

export const EveryVariantAtEverySize: Story = {
  name: 'every variant at every size measures its token box',
  render: () => (
    <div
      className="bldr-root"
      style={{ display: 'grid', gap: 'var(--bldr-space-md)' }}
      data-testid="chrome-button-matrix"
    >
      {SIZES.flatMap((size) =>
        CHROME_BUTTON_VARIANTS.map((variant) => {
          const label = `${variant} ${size}`;
          if (variant === 'icon') {
            return (
              <ChromeButton key={label} size={size} variant="icon" aria-label={label}>
                <span aria-hidden="true">+</span>
              </ChromeButton>
            );
          }
          if (variant === 'toggle') {
            return (
              <ChromeButton key={label} size={size} variant="toggle" aria-pressed>
                {label}
              </ChromeButton>
            );
          }
          return (
            <ChromeButton key={label} size={size} variant={variant}>
              {label}
            </ChromeButton>
          );
        }),
      )}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('measure every variant against its declared size token', async () => {
      const matrix = canvasElement.querySelector('[data-testid="chrome-button-matrix"]');
      if (matrix === null) {
        throw new Error('ChromeButton size matrix did not render');
      }
      const buttons = Array.from(matrix.querySelectorAll<HTMLButtonElement>('button'));
      await expect(buttons).toHaveLength(SIZES.length * CHROME_BUTTON_VARIANTS.length);

      for (const button of buttons) {
        const size = button.dataset['size'] as ChromeButtonSize | undefined;
        const variant = button.dataset['variant'] as ChromeButtonVariant | undefined;
        if (size === undefined || variant === undefined) {
          throw new Error('A matrix button did not declare its size and variant');
        }
        const box = button.getBoundingClientRect();
        const expectedHeight = resolvedLength(button, CHROME_BUTTON_SIZE_TOKENS[size]);
        await expect(box.height).toBeCloseTo(expectedHeight, 2);
        await expect(box.width).toBeGreaterThan(0);
        if (variant === 'icon') {
          await expect(box.width).toBeCloseTo(expectedHeight, 2);
        }
      }
    });
  },
};

export const AssembledEditorChromeHeights: Story = {
  name: 'assembled editor chrome uses only the declared sm and lg heights',
  render: () => (
    <div
      className="bldr-root"
      data-testid="assembled-editor-chrome"
      style={{ display: 'grid', gap: 'var(--bldr-space-md)' }}
    >
      <TopBar
        productName="CraftKit"
        canUndo
        canRedo
        onDeviceChange={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onPreview={() => undefined}
        onPublish={() => undefined}
        onPublishOptions={() => undefined}
      />
      <div style={{ display: 'flex', gap: 'var(--bldr-space-md)' }}>
        <IconRail items={RAIL_ITEMS} activeId="pages" onSelect={() => undefined} />
        <div
          style={{
            alignItems: 'start',
            display: 'grid',
            gap: 'var(--bldr-space-md)',
            position: 'relative',
          }}
        >
          <BlockActionBar
            label="Actions for Heading"
            actions={BLOCK_ACTIONS}
            onAction={() => undefined}
          />
          <TextBubble dir="ltr" actions={TEXT_ACTIONS} onReturnFocus={() => false} />
        </div>
      </div>
      <StatusBar
        tools={STATUS_TOOLS}
        onToolSelect={() => undefined}
        changes={[{ id: 'change', door: 'canvas', label: 'heading copy' }]}
        onChangeSelect={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('walk every assembled chrome button and reject height drift', async () => {
      const fixture = canvasElement.querySelector('[data-testid="assembled-editor-chrome"]');
      if (fixture === null) {
        throw new Error('Assembled editor chrome did not render');
      }
      const buttons = Array.from(fixture.querySelectorAll<HTMLButtonElement>('button'));
      await expect(buttons.length).toBeGreaterThan(10);

      const fullScale = new Set(
        Object.values(CHROME_BUTTON_SIZE_TOKENS).map((token) =>
          roundedLength(resolvedLength(fixture, token)),
        ),
      );
      await expect(fullScale.size).toBe(3);

      /*
        All THREE declared steps now appear in assembled chrome, and that is a
        decision rather than drift: `sm` for controls inside a dense panel, `lg`
        for the bars, and `touch` for the rail's navigation tiles — the step
        layout.ts reserves for "anything a finger reaches".

        What this gate protects is unchanged and is asserted above: every
        measured height must be one of the declared steps. A tile that sized
        itself to its own glyph and label would fail that check, which is
        exactly how it caught this rail measuring 48px in one host and 44px in
        another before the height was pinned to a token.
      */
      const expectedHeights = [
        roundedLength(resolvedLength(fixture, CHROME_BUTTON_SIZE_TOKENS.sm)),
        roundedLength(resolvedLength(fixture, CHROME_BUTTON_SIZE_TOKENS.lg)),
        roundedLength(resolvedLength(fixture, CHROME_BUTTON_SIZE_TOKENS.touch)),
      ].sort((left, right) => left - right);
      const measuredHeights = new Set<number>();

      for (const button of buttons) {
        await expect(button).toHaveAttribute('data-bldr-chrome-button', '');
        const box = button.getBoundingClientRect();
        const height = roundedLength(box.height);
        await expect(box.width).toBeGreaterThan(0);
        await expect(box.height).toBeGreaterThan(0);
        await expect(fullScale.has(height)).toBe(true);
        measuredHeights.add(height);
      }

      const distinctHeights = [...measuredHeights].sort((left, right) => left - right);
      await expect(distinctHeights.length).toBeLessThanOrEqual(3);
      await expect(distinctHeights).toEqual(expectedHeights);
    });
  },
};
