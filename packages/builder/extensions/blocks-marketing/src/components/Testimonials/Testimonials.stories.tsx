import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { testimonialsExamples } from './examples';
import { testimonialsSchema } from './schema';
import { Testimonials } from './Testimonials';

const node: Node = { id: 'testimonials-story', type: 'testimonials', props: {} };
const exampleProps = (index: number) =>
  testimonialsSchema.props.parse((testimonialsExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Testimonials',
  component: Testimonials,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Testimonials>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleQuote: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: testimonialsSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};

const proofItems = [
  { quote: 'The controls are finally clear.', author: 'Rana', role: 'Design lead' },
  { quote: 'We shipped the page in an afternoon.', author: 'Sam', role: 'Founder' },
  { quote: 'Every layout choice behaves predictably.', author: 'Noor', role: 'Engineer' },
];

const proofProps = (overrides: Record<string, unknown>) =>
  testimonialsSchema.props.parse({
    heading: 'Testimonial controls',
    items: proofItems,
    ...overrides,
  });

const proofElement = (canvasElement: HTMLElement, testId: string, selector: string) => {
  const element = within(canvasElement).getByTestId(testId).querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing ${selector} in ${testId}`);
  }
  return element;
};

export const ControlRenderingContract: Story = {
  args: SingleQuote.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%' }}>
      <div data-testid="testimonials-body-absent">
        <Testimonials
          node={{ ...node, id: 'testimonials-body-absent' }}
          props={proofProps({ heading: 'Supporting copy absent' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      <div data-testid="testimonials-body-present">
        <Testimonials
          node={{ ...node, id: 'testimonials-body-present' }}
          props={proofProps({
            body: 'Stories from teams like yours.',
            heading: 'Supporting copy present',
          })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['start', 'center', 'end'] as const).map((align) => (
        <div key={align} data-testid={`testimonials-align-${align}`}>
          <Testimonials
            node={{ ...node, id: `testimonials-align-${align}` }}
            props={proofProps({ align, heading: `Alignment ${align}` })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['transparent', 'light', 'dark'] as const).map((tone) => (
        <div key={tone} data-testid={`testimonials-tone-${tone}`}>
          <Testimonials
            node={{ ...node, id: `testimonials-tone-${tone}` }}
            props={proofProps({ heading: `Tone ${tone}`, tone })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['none', 'sm', 'md', 'lg'] as const).map((spacing) => (
        <div key={spacing} data-testid={`testimonials-spacing-${spacing}`}>
          <Testimonials
            node={{ ...node, id: `testimonials-spacing-${spacing}` }}
            props={proofProps({ heading: `Spacing ${spacing}`, spacing })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['narrow', 'standard', 'wide', 'full'] as const).map((width) => (
        <div key={width} data-testid={`testimonials-width-${width}`}>
          <Testimonials
            node={{ ...node, id: `testimonials-width-${width}` }}
            props={proofProps({ heading: `Width ${width}`, width })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      <div data-testid="testimonials-columns-auto-wide">
        <Testimonials
          node={{ ...node, id: 'testimonials-columns-auto-wide' }}
          props={proofProps({ columns: 'auto', heading: 'Columns auto wide', width: 'full' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      <div data-testid="testimonials-columns-auto-narrow" style={{ inlineSize: '20rem' }}>
        <Testimonials
          node={{ ...node, id: 'testimonials-columns-auto-narrow' }}
          props={proofProps({ columns: 'auto', heading: 'Columns auto narrow', width: 'full' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['1', '2', '3'] as const).map((columns) => (
        <div key={columns} data-testid={`testimonials-columns-${columns}`}>
          <Testimonials
            node={{ ...node, id: `testimonials-columns-${columns}` }}
            props={proofProps({ columns, heading: `Columns ${columns}`, width: 'full' })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('supporting copy paints and changes measured content', async () => {
      const absent = proofElement(
        canvasElement,
        'testimonials-body-absent',
        '[data-testimonials-content]',
      );
      const present = proofElement(
        canvasElement,
        'testimonials-body-present',
        '[data-testimonials-content]',
      );
      const body = proofElement(
        canvasElement,
        'testimonials-body-present',
        '[data-testimonials-intro]',
      );
      await expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
      await expect(present.getBoundingClientRect().height).toBeGreaterThan(
        absent.getBoundingClientRect().height,
      );
    });

    await step('alignment and tone resolve to distinct painted values', async () => {
      const alignments = (['start', 'center', 'end'] as const).map(
        (align) =>
          getComputedStyle(
            proofElement(
              canvasElement,
              `testimonials-align-${align}`,
              '[data-testimonials-content]',
            ),
          ).textAlign,
      );
      await expect(alignments).toEqual(['start', 'center', 'end']);
      const tones = (['transparent', 'light', 'dark'] as const).map((tone) =>
        getComputedStyle(proofElement(canvasElement, `testimonials-tone-${tone}`, 'section')),
      );
      await expect(new Set(tones.map((style) => style.backgroundColor)).size).toBe(3);
      await expect(tones[1]?.color).not.toBe(tones[2]?.color);
    });

    await step('spacing resolves every scale member and preserves the legacy default', async () => {
      const paddings = (['none', 'sm', 'md', 'lg'] as const).map((spacing) =>
        Number.parseFloat(
          getComputedStyle(
            proofElement(canvasElement, `testimonials-spacing-${spacing}`, 'section'),
          ).paddingBlockStart,
        ),
      );
      await expect(paddings).toEqual([0, 16, 32, 64]);
    });

    await step('width changes the content box while the painted surface remains full', async () => {
      const roots = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(
            canvasElement,
            `testimonials-width-${width}`,
            'section',
          ).getBoundingClientRect().width,
      );
      const contents = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(
            canvasElement,
            `testimonials-width-${width}`,
            '[data-testimonials-content]',
          ).getBoundingClientRect().width,
      );
      await expect(new Set(roots).size).toBe(1);
      await expect(contents[0] ?? 0).toBeLessThan(contents[3] ?? 0);
      const maxWidths = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          getComputedStyle(
            proofElement(
              canvasElement,
              `testimonials-width-${width}`,
              '[data-testimonials-content]',
            ),
          ).maxWidth,
      );
      await expect(new Set(maxWidths).size).toBe(4);
    });

    await step('fixed columns and responsive auto produce distinct measured layouts', async () => {
      const fixedGrids = (['1', '2', '3'] as const).map((columns) =>
        proofElement(canvasElement, `testimonials-columns-${columns}`, '[data-testimonials-grid]'),
      );
      await expect(
        new Set(fixedGrids.map((grid) => getComputedStyle(grid).gridTemplateColumns)).size,
      ).toBe(3);
      const cardWidths = fixedGrids.map((grid) => {
        const card = grid.querySelector<HTMLElement>('[data-testimonials-card]');
        if (card === null) throw new Error('Missing testimonial card');
        return card.getBoundingClientRect().width;
      });
      await expect(cardWidths[0] ?? 0).toBeGreaterThan(cardWidths[2] ?? 0);

      const autoWide = proofElement(
        canvasElement,
        'testimonials-columns-auto-wide',
        '[data-testimonials-grid]',
      );
      const autoNarrow = proofElement(
        canvasElement,
        'testimonials-columns-auto-narrow',
        '[data-testimonials-grid]',
      );
      await expect(getComputedStyle(autoWide).gridTemplateColumns).not.toBe(
        getComputedStyle(autoNarrow).gridTemplateColumns,
      );
    });
  },
};

/* Block parts (DESIGN §4.4): each inner element is a part on the canvas, styled per part. */
export const Parts: Story = {
  args: {
    node,
    props: {
      ...testimonialsSchema.props.parse({
        eyebrow: 'Customers',
        heading: 'Loved by teams.',
        body: 'What they say.',
        items: [
          {
            quote: 'It just works.',
            author: 'Rana',
            role: 'Staff Engineer',
            company: 'Acme',
            rating: 5,
          },
          { quote: 'Arabic first.', author: 'Omar', role: 'Designer' },
        ],
      }),
      partStyles: {
        'item.quote': { className: 'text-accent' },
        'item.quote@0': { className: 'underline' },
      },
    },
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const styled = canvasElement.querySelectorAll('[data-ck-part="item.quote"]');
    await expect(styled.length).toBeGreaterThan(1);
    await expect(styled[0]).toHaveAttribute('data-ck-bind', 'items.0.quote');
    await expect(styled[0]).toHaveClass('underline');
    await expect(styled[1]).toHaveClass('text-accent');
    await expect(styled[1]).not.toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="items"]')).toHaveAttribute(
      'data-ck-bind',
      'items',
    );
  },
};
