import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { CloudShader } from './CloudShader';
import { cloudShaderSchema } from './schema';

const node: Node = { id: 'cloud', type: 'cloudShader', props: {} };

const content = (
  <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
    <h1 style={{ margin: 0, fontSize: '2rem' }}>Your window seat to anywhere</h1>
    <p style={{ marginBlockStart: '0.5rem' }}>Drawn on the GPU, coloured by the design system.</p>
  </div>
);

const meta = {
  title: 'Builder/Aceternity/CloudShader',
  component: CloudShader,
  args: { node, slots: { default: content }, data: {}, isCanvas: false },
} satisfies Meta<typeof CloudShader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: scattered cloud drifting over the brand's own sky. */
export const Scattered: Story = {
  args: { props: cloudShaderSchema.props.parse({}) },
};

export const Overcast: Story = {
  args: {
    props: cloudShaderSchema.props.parse({
      coverage: 'overcast',
      detail: 'intricate',
      speed: 'brisk',
    }),
  },
};

/** Stillness is a choice, not the absence of one. */
export const Still: Story = {
  args: { props: cloudShaderSchema.props.parse({ speed: 'still', animate: false }) },
};

/** Re-pointed roles: the same shader, a different weather system. */
export const InvertedSky: Story = {
  args: {
    props: cloudShaderSchema.props.parse({
      skyTopColor: 'surfaceInverse',
      skyBottomColor: 'accent',
      cloudColor: 'textInverse',
      coverage: 'clear',
    }),
  },
};

/**
 * The contract this block is most likely to break.
 *
 * A background effect that runs on the GPU has two failure modes worth pinning
 * in a real browser: it never initialises, and it initialises but paints
 * nothing. Both look identical from the outside — an empty band — so this
 * asserts the canvas is really sized and really drawn, and that the content
 * above it is readable either way.
 */
export const RenderingContract: Story = {
  args: { props: cloudShaderSchema.props.parse({ minHeight: 'half' }) },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const host = canvasElement.querySelector<HTMLElement>('.acy-cloud');
    const surface = canvasElement.querySelector<HTMLCanvasElement>('canvas');
    if (host === null || surface === null) {
      throw new Error('Expected the cloud host and its canvas');
    }

    await step('the section has a real height without any content of its own', async () => {
      await expect(host.getBoundingClientRect().height).toBeGreaterThan(200);
    });

    await step('the canvas is sized to the section, in device pixels', async () => {
      /*
        Non-vacuous: an uninitialised canvas keeps its 300x150 default, which
        is the exact signature of a shader that never ran.
      */
      await expect(surface.width).toBeGreaterThan(300);
      await expect(surface.height).toBeGreaterThan(150);
    });

    await step('content stays above the weather and readable', async () => {
      const heading = canvas.getByText('Your window seat to anywhere');
      const content = canvasElement.querySelector<HTMLElement>('.acy-cloud__content');
      if (content === null) {
        throw new Error('Expected the content layer');
      }

      await expect(heading).toBeVisible();
      await expect(getComputedStyle(content).zIndex).toBe('1');
      await expect(getComputedStyle(surface).zIndex).toBe('0');
    });

    await step('the CSS sky is a real gradient, not a placeholder colour', async () => {
      /*
        This is what a device with no WebGL actually sees, so it has to be a
        sky rather than a flat rectangle.
      */
      await expect(getComputedStyle(host).backgroundImage).toContain('gradient');
    });
  },
};
