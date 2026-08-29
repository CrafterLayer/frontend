import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyRichText,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { Inspector } from '@craftkit/builder-shell';

import { richTextExtension } from '../index';
import { RichTextField } from './RichTextField';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'richtext-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'article',
          description: 'Article',
          props: z.object({
            title: z.string().default(''),
            body: richText().default(emptyRichText() as never),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const doc = (dir: 'ltr' | 'rtl', text: string): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'a1',
  nodes: {
    a1: {
      id: 'a1',
      type: 'article',
      props: {
        title: 'Post',
        body: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text }],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Body with ' },
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: '.' },
              ],
            },
          ],
        },
      },
    },
  },
});

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr', text = 'Editable rich text') => {
  const kernel = createBuilder({
    document: doc(dir, text),
    extensions: [VOCAB, richTextExtension],
    ports: { clock: fixedClock(), ids: seededIds('rts') },
  });
  kernel.setSelection(['a1']);
  return kernel;
};

const meta = {
  title: 'Builder/Extensions/RichTextField',
  component: RichTextField,
} satisfies Meta<typeof RichTextField>;
export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
  schema: richText(),
  value: emptyRichText(),
  path: ['props', 'body'],
  onChange: () => undefined,
};

export const ViaInspector: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={makeKernel()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
    await expect(canvas.getByRole('group', { name: 'Formatting' })).toBeInTheDocument();
  },
};

const editKernel = makeKernel();
export const ToolbarCommits: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={editKernel} />,
  play: async ({ canvasElement }) => {
    // Idempotent: toggles bold on the whole selection and back — asserts the
    // transaction ARITHMETIC, never an absolute document state.
    const canvas = within(canvasElement);
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
    const content = canvasElement.querySelector('.tiptap');
    await expect(content).not.toBeNull();
    const before = editKernel.transactions().length;
    const selectAllThen = async (button: string) => {
      (content as HTMLElement).focus();
      await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
      await userEvent.click(canvas.getByRole('button', { name: button }));
    };
    await selectAllThen('Bold');
    await waitFor(async () => {
      await expect(editKernel.transactions().length).toBe(before + 1);
    });
    await selectAllThen('Bold'); // restore — rerun-idempotent
    await waitFor(async () => {
      await expect(editKernel.transactions().length).toBe(before + 2);
    });
  },
};

export const RightToLeft: Story = {
  args: baseArgs,
  render: () => <Inspector kernel={makeKernel('rtl', 'نص غني قابل للتحرير')} />,
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    });
  },
};

/** The states the catalog a11y gate must actually SEE (§10 review fix M7). */
const stateArgs = {
  schema: richText(),
  path: ['props', 'body'],
  onChange: () => undefined,
};

const COMMAND_NAMES = [
  'Bold',
  'Italic',
  'Heading 2',
  'Heading 3',
  'Bulleted list',
  'Numbered list',
  'Link',
  'Clear formatting',
] as const;

export const IconHouseStyle: Story = {
  name: 'Chromium · icon house style',
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => (
    <div style={{ inlineSize: '420px', maxInlineSize: '100%' }}>
      <RichTextField {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) {
      throw new Error('Chromium window must exist');
    }
    const renderedGlyphs = new Set<string>();

    // Mutation guard: changing any glyph to a 2px/square/non-currentColor
    // idiom makes this named Chromium story fail on resolved styles.
    await expect(buttons).toHaveLength(COMMAND_NAMES.length);
    for (const [index, button] of buttons.entries()) {
      const commandName = COMMAND_NAMES[index];
      if (commandName === undefined) {
        throw new Error(`Unexpected toolbar button at index ${String(index)}`);
      }
      await expect(button).toHaveAccessibleName(commandName);
      const buttonBox = button.getBoundingClientRect();
      const buttonStyle = view.getComputedStyle(button);
      const minimumInlineSize = Number.parseFloat(buttonStyle.minInlineSize);
      const minimumBlockSize = Number.parseFloat(buttonStyle.minBlockSize);
      await expect(minimumInlineSize).toBeGreaterThan(0);
      await expect(minimumBlockSize).toBeGreaterThan(0);
      await expect(buttonBox.width).toBeGreaterThanOrEqual(minimumInlineSize);
      await expect(buttonBox.height).toBeGreaterThanOrEqual(minimumBlockSize);

      const icon = button.querySelector('svg');
      if (icon === null) {
        throw new Error(`${commandName} must render an SVG icon`);
      }
      const iconBox = icon.getBoundingClientRect();
      const paintedBox = icon.getBBox();
      const iconStyle = view.getComputedStyle(icon);
      renderedGlyphs.add(icon.innerHTML);

      await expect(iconBox.width).toBe(17);
      await expect(iconBox.height).toBe(17);
      await expect(paintedBox.width).toBeGreaterThan(0);
      await expect(paintedBox.height).toBeGreaterThan(0);
      await expect(icon.getAttribute('viewBox')).toBe('0 0 16 16');
      await expect(iconStyle.fill).toBe('none');
      await expect(iconStyle.stroke).toBe(buttonStyle.color);
      await expect(iconStyle.strokeWidth).toBe('1.5px');
      await expect(iconStyle.strokeLinecap).toBe('round');
      await expect(iconStyle.strokeLinejoin).toBe('round');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).toHaveAttribute('focusable', 'false');
    }
    await expect(renderedGlyphs.size).toBe(COMMAND_NAMES.length);

    const bold = canvas.getByRole('button', { name: 'Bold' });
    const italic = canvas.getByRole('button', { name: 'Italic' });
    if (bold.getAttribute('aria-pressed') !== 'true') {
      await userEvent.click(bold);
    }
    await waitFor(async () => {
      await expect(bold).toHaveAttribute('aria-pressed', 'true');
      const pressedStyle = view.getComputedStyle(bold);
      const idleStyle = view.getComputedStyle(italic);
      await expect(pressedStyle.backgroundColor).not.toBe(idleStyle.backgroundColor);
      await expect(pressedStyle.borderColor).not.toBe(idleStyle.borderColor);
      await expect(pressedStyle.color).not.toBe(idleStyle.color);
    });

    const stylesheetRules = Array.from(canvasElement.ownerDocument.styleSheets).flatMap(
      (stylesheet) => {
        try {
          return Array.from(stylesheet.cssRules, (rule) => rule.cssText);
        } catch {
          return [];
        }
      },
    );
    // Mutation guard: deleting the reduced-motion tooltip override makes this
    // named Chromium story fail even when the default transition still works.
    await expect(
      stylesheetRules.some(
        (rule) =>
          rule.includes('@media (prefers-reduced-motion: reduce)') &&
          rule.includes('.bldr-richtext-field__tooltip') &&
          rule.includes('transition: none'),
      ),
    ).toBe(true);
  },
};

export const TooltipHoverFocusAndContainment: Story = {
  name: 'Chromium · tooltip hover, focus, and containment',
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div data-tooltip-fixture="ltr" dir="ltr" style={{ inlineSize: '312px' }}>
        <RichTextField {...args} />
      </div>
      <div data-tooltip-fixture="rtl" dir="rtl" style={{ inlineSize: '312px' }}>
        <RichTextField {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) {
      throw new Error('Chromium window must exist');
    }

    const getFixture = (direction: 'ltr' | 'rtl') => {
      const fixture = canvasElement.querySelector<HTMLElement>(
        `[data-tooltip-fixture="${direction}"]`,
      );
      if (fixture === null) {
        throw new Error(`${direction} tooltip fixture must render`);
      }
      const fixtureCanvas = within(fixture);
      return {
        toolbar: fixtureCanvas.getByRole('group', { name: 'Formatting' }),
        tooltip: fixtureCanvas.getByRole('tooltip', { hidden: true }),
        clear: fixtureCanvas.getByRole('button', { name: 'Clear formatting' }),
        bold: fixtureCanvas.getByRole('button', { name: 'Bold' }),
      };
    };
    const ltr = getFixture('ltr');
    const rtl = getFixture('rtl');

    const expectVisibleInsideToolbar = async (
      toolbar: HTMLElement,
      tooltip: HTMLElement,
      anchor: HTMLElement,
      label: string,
    ) => {
      await waitFor(async () => {
        const tooltipStyle = view.getComputedStyle(tooltip);
        await expect(tooltip).toHaveTextContent(label);
        await expect(tooltipStyle.visibility).toBe('visible');
        await expect(Number.parseFloat(tooltipStyle.opacity)).toBe(1);

        const toolbarBox = toolbar.getBoundingClientRect();
        const tooltipBox = tooltip.getBoundingClientRect();
        const anchorBox = anchor.getBoundingClientRect();
        const anchorCenter = anchorBox.left + anchorBox.width / 2;
        await expect(toolbarBox.width).toBeGreaterThan(0);
        await expect(toolbarBox.height).toBeGreaterThan(0);
        await expect(tooltipBox.width).toBeGreaterThan(0);
        await expect(tooltipBox.height).toBeGreaterThan(0);
        await expect(anchorBox.width).toBeGreaterThan(0);
        await expect(tooltipBox.left).toBeGreaterThanOrEqual(toolbarBox.left - 0.5);
        await expect(tooltipBox.right).toBeLessThanOrEqual(toolbarBox.right + 0.5);
        await expect(tooltipBox.top).toBeGreaterThanOrEqual(toolbarBox.top - 0.5);
        await expect(tooltipBox.bottom).toBeLessThanOrEqual(toolbarBox.bottom + 0.5);
        await expect(anchorCenter).toBeGreaterThanOrEqual(tooltipBox.left - 0.5);
        await expect(anchorCenter).toBeLessThanOrEqual(tooltipBox.right + 0.5);
      });
    };

    await expect(ltr.tooltip).toHaveAttribute('aria-hidden', 'true');
    await expect(rtl.tooltip).toHaveAttribute('aria-hidden', 'true');
    await expect(view.getComputedStyle(ltr.toolbar).direction).toBe('ltr');
    await expect(view.getComputedStyle(rtl.toolbar).direction).toBe('rtl');
    await expect(view.getComputedStyle(ltr.tooltip).visibility).toBe('hidden');
    await expect(view.getComputedStyle(rtl.tooltip).visibility).toBe('hidden');

    // Mutation guard: removing the hover event, focus event, either direction's
    // positioning branch, or edge clamping makes this named story fail.
    await userEvent.hover(ltr.clear);
    await expectVisibleInsideToolbar(ltr.toolbar, ltr.tooltip, ltr.clear, 'Clear formatting');
    await userEvent.unhover(ltr.clear);
    await waitFor(async () => {
      await expect(view.getComputedStyle(ltr.tooltip).visibility).toBe('hidden');
    });

    canvasElement.ownerDocument.body.focus();
    await userEvent.tab();
    await expect(ltr.bold).toHaveFocus();
    await expectVisibleInsideToolbar(ltr.toolbar, ltr.tooltip, ltr.bold, 'Bold');

    await userEvent.hover(rtl.clear);
    await expectVisibleInsideToolbar(rtl.toolbar, rtl.tooltip, rtl.clear, 'Clear formatting');
  },
};

export const ResponsiveToolbarFit: Story = {
  name: 'Chromium · responsive toolbar fit',
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div data-toolbar-fixture="wide" style={{ inlineSize: '420px', maxInlineSize: '100%' }}>
        <RichTextField {...args} />
      </div>
      <div data-toolbar-fixture="narrow" style={{ inlineSize: '312px', maxInlineSize: '100%' }}>
        <RichTextField {...args} />
      </div>
      <div
        data-toolbar-fixture="constrained"
        style={{ inlineSize: '242px', maxInlineSize: '100%' }}
      >
        <RichTextField {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const assertContained = async (fixtureName: 'wide' | 'narrow' | 'constrained') => {
      const fixture = canvasElement.querySelector<HTMLElement>(
        `[data-toolbar-fixture="${fixtureName}"]`,
      );
      if (fixture === null) {
        throw new Error(`${fixtureName} toolbar fixture must render`);
      }
      const toolbar = within(fixture).getByRole('group', { name: 'Formatting' });
      const buttons = within(fixture).getAllByRole('button');
      const fixtureBox = fixture.getBoundingClientRect();
      const toolbarBox = toolbar.getBoundingClientRect();

      await expect(fixtureBox.width).toBeGreaterThan(0);
      await expect(toolbarBox.width).toBeGreaterThan(0);
      await expect(buttons).toHaveLength(COMMAND_NAMES.length);
      await expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
      await expect(toolbarBox.left).toBeGreaterThanOrEqual(fixtureBox.left - 0.5);
      await expect(toolbarBox.right).toBeLessThanOrEqual(fixtureBox.right + 0.5);
      await expect(toolbarBox.top).toBeGreaterThanOrEqual(fixtureBox.top - 0.5);
      await expect(toolbarBox.bottom).toBeLessThanOrEqual(fixtureBox.bottom + 0.5);
      for (const button of buttons) {
        const buttonBox = button.getBoundingClientRect();
        await expect(buttonBox.width).toBeGreaterThan(0);
        await expect(buttonBox.height).toBeGreaterThan(0);
        await expect(buttonBox.left).toBeGreaterThanOrEqual(toolbarBox.left - 0.5);
        await expect(buttonBox.right).toBeLessThanOrEqual(toolbarBox.right + 0.5);
      }
      return new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size;
    };

    // Mutation guard: wider targets make the 312px fixture wrap; disabling
    // wrapping makes the constrained fixture overflow.
    const wideRows = await assertContained('wide');
    const narrowRows = await assertContained('narrow');
    const constrainedRows = await assertContained('constrained');
    await expect(wideRows).toBe(1);
    await expect(narrowRows).toBe(wideRows);
    await expect(constrainedRows).toBeGreaterThan(narrowRows);
    const narrow = canvasElement.querySelector<HTMLElement>('[data-toolbar-fixture="narrow"]');
    const constrained = canvasElement.querySelector<HTMLElement>(
      '[data-toolbar-fixture="constrained"]',
    );
    await expect(narrow?.getBoundingClientRect().width).toBe(312);
    await expect(constrained?.getBoundingClientRect().width).toBe(242);
  },
};

export const Empty: Story = {
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.bldr-richtext-field__surface')).not.toBeNull();
    await expect(within(canvasElement).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: { ...stateArgs, value: emptyRichText(), disabled: true },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    // A disabled field cannot commit — the toolbar is inert too, not just the
    // typing surface (§10 review fix M1).
    const canvas = within(canvasElement);
    for (const name of ['Bold', 'Italic', 'Link', 'Clear formatting']) {
      await expect(canvas.getByRole('button', { name })).toBeDisabled();
    }
  },
};

export const ResponsiveNoticeState: Story = {
  name: 'Responsive notice',
  args: { ...stateArgs, value: emptyRichText(), path: ['responsive', 'tablet', 'body'] },
  render: (args) => <RichTextField {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/switch to desktop/i);
    // e5: the notice must not instantiate the engine.
    await expect(canvasElement.querySelector('.bldr-richtext-field__surface')).toBeNull();
  },
};

/**
 * The field is ONE control, so focusing it draws ONE ring.
 *
 * Wrapped in `.bldr-root` on purpose: that is what brings the product-wide
 * focus rule into scope, and without it this story could never reproduce the
 * defect it guards. Measured before the fix: the wrapper and the surface inside
 * it both painted an identical 2px accent ring, 1px apart.
 */
export const OneRingForTheWholeField: Story = {
  name: 'Focusing the field draws exactly one ring',
  args: { ...stateArgs, value: emptyRichText() },
  render: (args) => (
    <div className="bldr-root">
      <RichTextField {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector<HTMLElement>('.bldr-richtext-field');
    const surface = canvasElement.querySelector<HTMLElement>('.bldr-richtext-field__surface');
    if (field === null || surface === null) {
      throw new Error('The field and its editing surface must render');
    }
    const view = canvasElement.ownerDocument.defaultView;
    if (view === null) {
      throw new Error('The field has no rendering window');
    }

    surface.focus();
    await expect(surface).toHaveFocus();

    // Non-vacuous: the wrapper must actually be drawing a ring, or "only one
    // ring" would be satisfied by a field that shows no focus at all.
    const wrapper = view.getComputedStyle(field);
    await expect(wrapper.outlineStyle).toBe('solid');
    await expect(Number.parseFloat(wrapper.outlineWidth)).toBeGreaterThan(0);

    // The surface delegates rather than removing: the ring moved, it did not go.
    await expect(surface.getAttribute('data-bldr-focus-ring')).toBe('delegated');
    await expect(view.getComputedStyle(surface).outlineStyle).toBe('none');

    // And exactly one element in the focus chain paints one.
    const painting = [field, surface].filter((element) => {
      const painted = view.getComputedStyle(element);
      return painted.outlineStyle !== 'none' && Number.parseFloat(painted.outlineWidth) > 0;
    });
    await expect(painting).toEqual([field]);
  },
};
