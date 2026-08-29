import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { BuilderShell } from './BuilderShell';

/**
 * The regions are deliberately unstyled placeholders. This component's whole
 * claim is about SPACE — which region gets which pixels — so anything that
 * looked like a real palette here would hide the thing under test.
 */
function Region({ name, tone = 'panel' }: { name: string; tone?: 'panel' | 'rail' | 'canvas' }) {
  const background =
    tone === 'rail'
      ? 'var(--bldr-rail)'
      : tone === 'canvas'
        ? 'var(--bldr-ground)'
        : 'var(--bldr-panel)';
  const color = tone === 'rail' ? 'var(--bldr-rail-text)' : 'var(--bldr-panel-muted)';
  return (
    <div
      data-testid={`region-${name.toLowerCase()}`}
      style={{
        alignItems: 'center',
        background,
        blockSize: '100%',
        color,
        display: 'flex',
        font: '500 var(--bldr-font-size-caption)/1 var(--bldr-font)',
        inlineSize: tone === 'rail' ? 'var(--bldr-rail-width)' : '100%',
        justifyContent: 'center',
        letterSpacing: '.08em',
        textTransform: 'uppercase',
      }}
    >
      {name}
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/BuilderShell',
  component: BuilderShell,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ blockSize: '620px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuilderShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const everything = {
  top: <Region name="Top bar" />,
  rail: <Region name="Rail" tone="rail" />,
  panel: <Region name="Blocks" />,
  canvas: <Region name="Canvas" tone="canvas" />,
  aside: <Region name="Inspector" />,
  status: <Region name="Status" />,
};

export const FullEditor: Story = {
  args: everything,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('region-canvas')).toBeVisible();
    await expect(canvas.getByTestId('region-blocks')).toBeVisible();
    await expect(canvas.getByTestId('region-inspector')).toBeVisible();
  },
};

export const WithDock: Story = {
  args: { ...everything, dock: <Region name="Code view" /> },
  play: async ({ canvasElement }) => {
    // The dock takes height from the CANVAS, never from the panel or the
    // inspector: opening it must not narrow anything beside it.
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId('region-blocks').getBoundingClientRect();
    const dock = canvas.getByTestId('region-code view').getBoundingClientRect();
    const stage = canvas.getByTestId('region-canvas').getBoundingClientRect();
    await expect(dock.height).toBeGreaterThan(0);
    await expect(panel.width).toBeGreaterThan(200);
    // The dock sits under the canvas, sharing its column.
    await expect(dock.top).toBeGreaterThanOrEqual(stage.bottom - 1);
  },
};

/** Opening the assistant folds the palette away rather than squeezing the page. */
export const AssistantOpen: Story = {
  args: {
    top: everything.top,
    rail: everything.rail,
    canvas: everything.canvas,
    aside: <Region name="Assistant" />,
    status: everything.status,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId('region-blocks')).toBe(null);
    // Every pixel the palette gave up went to the page, not to the chrome.
    const stage = canvas.getByTestId('region-canvas').getBoundingClientRect();
    await expect(stage.width).toBeGreaterThan(500);
  },
};

/** The canvas alone — a preview or a focus mode. */
export const CanvasOnly: Story = {
  args: { canvas: everything.canvas },
  play: async ({ canvasElement }) => {
    // An absent region must cost NOTHING: the canvas fills the shell.
    const canvas = within(canvasElement);
    const shell = canvas.getByRole('application').getBoundingClientRect();
    const stage = canvas.getByTestId('region-canvas').getBoundingClientRect();
    await expect(Math.round(stage.width)).toBe(Math.round(shell.width));
  },
};

export const RightToLeft: Story = {
  args: everything,
  decorators: [
    (Story) => (
      <div className="bldr-root" dir="rtl" style={{ blockSize: '620px' }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    // Mirroring is a CSS fact, not a prop: the rail must sit on the RIGHT with
    // no extra stylesheet, which is what logical properties buy.
    const canvas = within(canvasElement);
    const rail = canvas.getByTestId('region-rail').getBoundingClientRect();
    const aside = canvas.getByTestId('region-inspector').getBoundingClientRect();
    await expect(rail.left).toBeGreaterThan(aside.left);
  },
};

/**
 * What a narrow viewport is allowed to take away.
 *
 * Below 1180 the shell drops the panel, because a palette is a source you dip
 * into and the canvas is the subject. That reasoning is false when the host has
 * put the document's structure there, and the shell never sees which one it was
 * handed — so the host says, and this proves the shell listens.
 */
export const NarrowViewportKeepsAnEssentialPanel: Story = {
  args: { ...FullEditor.args },
  render: () => <div data-testid="narrow-host" style={{ blockSize: '360px' }} />,
  play: async ({ canvasElement }) => {
    /*
      Measured at a REAL narrow viewport, which is the only place this can be
      measured: the rule is a media query, so a smaller container proves
      nothing and the test runner's own window is wide. An iframe has its own
      viewport, and copying the host's stylesheets into it is the same trick
      `CanvasFrame` uses to render the edited page.

      Without the host's say-so the layer tree simply vanished between 900 and
      1180 while the rail still marked it as the open destination — measured in
      the running application, and invisible to every test in this repository.
    */
    const host = canvasElement.querySelector('[data-testid="narrow-host"]');
    if (host === null) {
      throw new Error('the story did not render its host');
    }

    const frame = document.createElement('iframe');
    frame.style.inlineSize = '1100px';
    frame.style.blockSize = '340px';
    frame.style.border = '0';
    host.appendChild(frame);

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (doc === null || win === null) {
      throw new Error('the iframe never got a document');
    }

    for (const sheet of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      doc.head.appendChild(sheet.cloneNode(true));
    }
    doc.body.style.margin = '0';
    doc.body.innerHTML = `
      <div class="bldr-shell" data-bldr-panel-priority="optional">
        <div class="bldr-shell__panel" id="optional-panel">panel</div>
        <div class="bldr-shell__main"><div class="bldr-shell__canvas">canvas</div></div>
      </div>
      <div class="bldr-shell" data-bldr-panel-priority="essential">
        <div class="bldr-shell__panel" id="essential-panel">panel</div>
        <div class="bldr-shell__main"><div class="bldr-shell__canvas">canvas</div></div>
      </div>`;

    // Non-vacuous: if the stylesheets did not arrive, nothing below means
    // anything, and if the frame is not actually narrow the rule never applies.
    await expect(win.innerWidth).toBeLessThan(1180);
    const shell = doc.querySelector('.bldr-shell');
    if (shell === null) {
      throw new Error('the iframe shell did not render');
    }
    await expect(win.getComputedStyle(shell).display).toBe('grid');

    const optional = doc.querySelector('#optional-panel');
    const essential = doc.querySelector('#essential-panel');
    if (optional === null || essential === null) {
      throw new Error('the iframe panels did not render');
    }

    await expect(win.getComputedStyle(optional).display).toBe('none');
    await expect(win.getComputedStyle(essential).display).not.toBe('none');

    frame.remove();
  },
};
