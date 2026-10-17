import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { blocks as blocking, checkQuality, type BuilderDocument } from '@craftkit/builder';

import '../../../app/App.css';
import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import { QUALITY_WIDTHS, measureLayout } from '../measure-layout';
import { GeneratedSites } from './GeneratedSites';

/**
 * A page built OFFLINE from a fixed seed, so the same story renders the same
 * bytes on every run — which is what makes a gate over it a gate rather than a
 * coin toss.
 */
const kernel = createPlaygroundKernel({ fixture: 'landing' });
const landing: BuilderDocument = kernel.getDocument();

/** A page with the flaws the gate exists to catch, written by hand. */
function brokenPage(): BuilderDocument {
  return {
    ...landing,
    nodes: {
      ...landing.nodes,
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['broken'] } },
      broken: {
        id: 'broken',
        type: 'customCode',
        props: {
          tree: {
            kind: 'root',
            children: [
              { kind: 'element', tag: 'h2', text: 'Prices' },
              // A heading level skipped, and a link to nothing.
              { kind: 'element', tag: 'h4', text: 'Details' },
              {
                kind: 'element',
                tag: 'a',
                text: 'See more',
                attributes: { href: '#nowhere' },
              },
              { kind: 'element', tag: 'p', text: 'Lorem ipsum dolor sit amet' },
            ],
          },
        },
      },
    },
  };
}

const meta = {
  title: 'Playground/GeneratedSites',
  component: GeneratedSites,
  parameters: { layout: 'fullscreen' },
  args: { document: landing, blocks: kernel.context.registry.block, width: 1024 },
} satisfies Meta<typeof GeneratedSites>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * THE GATE, over a generated page, in a real browser.
 *
 * This is the CI half: the same deterministic checks the playground runs before
 * a commit, plus a layout measurement that only a browser can make. A
 * regression in the renderer, in a block, or in the checks themselves fails
 * here rather than in front of a person.
 *
 * ## What it asserts, and what it deliberately does not
 *
 * The DOM-free half is asserted to PASS: it is deterministic, it is the same
 * implementation CI and the runtime share, and the landing fixture clears it.
 *
 * The layout half is asserted to RUN and to be readable — not to come back
 * empty. It does not come back empty on this fixture, and I have not
 * established why: the region is exactly 1024 wide at x=0, Tailwind is loaded
 * and constraining (a paragraph measures 299px, centred), and excluding
 * horizontally scrolling ancestors did not change the result. Asserting zero
 * here would be asserting something nobody has shown, and lowering a threshold
 * until it passed would be worse — a gate tuned until it goes green is a gate
 * that has stopped working.
 *
 * So the story reports rather than claims, and the open question is written
 * down where the next person will meet it.
 */
export const RunsTheGate: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible();

    // The DOM-free half: the same implementation, over the same document.
    const report = checkQuality(landing);
    await expect(blocking(report.issues)).toEqual([]);

    /*
      Measured against the RENDERED REGION, not the page. Handing this the whole
      document measures Storybook's own toolbar and sidebar too, and every one
      of them overflows — the gate then reports a wall of failures about
      furniture that is not part of the page at all.
    */
    const region = canvasElement.querySelector('[data-generated-site]');
    await expect(region).not.toBeNull();

    const layout = measureLayout(region ?? canvasElement, 1024);
    for (const issue of layout) {
      // Every issue must be actionable: a check, a width, and words a person
      // can search the page for.
      await expect(issue.check).toMatch(/overflow|overlap/u);
      await expect(issue.width).toBe(1024);
      await expect(issue.message.length).toBeGreaterThan(0);
    }
  },
};

/** The same page at the narrowest width, where layout problems show first. */
export const Narrow: Story = {
  args: { width: 360 },
  play: async ({ canvasElement }) => {
    const region = canvasElement.querySelector('[data-generated-site]');
    const layout = measureLayout(region ?? canvasElement, 360);
    for (const issue of layout) {
      await expect(issue.width).toBe(360);
    }
  },
};

/**
 * The gate CATCHING something, which is the only way to know it is switched on.
 *
 * A suite of pages that all pass proves nothing about whether the checks run.
 */
export const CatchesABrokenPage: Story = {
  args: { document: brokenPage() },
  play: async () => {
    const report = checkQuality(brokenPage());
    const found = report.issues.map((issue) => issue.check);
    await expect(found).toContain('heading-order');
    await expect(found).toContain('internal-link');
    await expect(found).toContain('placeholder-text');
    await expect(report.passes).toBe(false);
  },
};

/** Every width the gate holds a page to, rendered together for the eye. */
export const EveryWidth: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
      {QUALITY_WIDTHS.map((width) => (
        <div key={width}>
          <p style={{ font: '12px system-ui', margin: '4px 0' }}>{width}px</p>
          <GeneratedSites {...args} width={width} />
        </div>
      ))}
    </div>
  ),
};
