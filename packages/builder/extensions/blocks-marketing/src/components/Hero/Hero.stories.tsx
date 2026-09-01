import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';
import { lightTheme, tokenCssName, type TokenName } from '@craftkit/builder-renderer';

import { Hero } from './Hero';
import { heroSchema } from './schema';

const node: Node = { id: 'hero-story', type: 'hero', props: {} };

/*
  Blocks read the PAGE theme, so a story that measures one has to mount it.

  Without this the block falls back to the literals in its own stylesheet and a
  token assertion can only ever restate them. Worse, this story used to read the
  EDITOR's spacing scale against a block styled from the PAGE's: 6px measured
  against 8px, two vocabularies kept deliberately apart so a dark editor never
  repaints a light page.

  (Written without naming the editor's tokens literally: the theme package scans
  source for token usages, and a name in a comment reads as a real one.)
*/
const meta = {
  title: 'Builder/Blocks/Hero',
  component: Hero,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div data-page-theme style={pageThemeStyle()}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Hero>;

/** The page theme as inline custom properties, so `var(--t-…)` resolves. */
function pageThemeStyle(): CSSProperties {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(lightTheme)) {
    style[tokenCssName(name as TokenName)] = value;
  }
  return style;
}

/**
 * A subtree with NO design system, which is what publishing produces.
 *
 * `initial` on a custom property is the one way to un-declare it: it sets the
 * guaranteed-invalid value, so `var(--t-gap-lg, 32px)` takes its fallback
 * exactly as it would on a page where the token was never written at all. That
 * is reachable per element rather than only at `:root` because `@theme inline`
 * compiles a utility to `gap: var(--t-gap-lg, 32px)` directly, instead of
 * routing it through a variable resolved once at the document root.
 */
function unthemedStyle(): CSSProperties {
  const style: Record<string, string> = {};
  for (const name of Object.keys(lightTheme)) {
    style[tokenCssName(name as TokenName)] = 'initial';
  }
  return style;
}

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: {
    node,
    props: heroSchema.props.parse({
      tone: 'light',
      align: 'center',
      heading: 'See your numbers clearly',
      body: 'Realtime analytics without the noise.',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const DarkWithActions: Story = {
  args: {
    ...Light.args,
    props: heroSchema.props.parse({
      tone: 'dark',
      align: 'start',
      heading: 'Build faster tonight',
    }),
    slots: { actions: <button type="button">Get started</button> },
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Light.args,
    props: heroSchema.props.parse({
      tone: 'dark',
      align: 'center',
      heading: 'عود يليق بذوقك',
      body: 'تركيبات فاخرة تدوم طويلاً',
    }),
  },
};

const proofProps = (overrides: Record<string, unknown>) =>
  heroSchema.props.parse({
    heading: 'Builder controls',
    body: 'Visible supporting copy.',
    ...overrides,
  });

const proofElement = (canvasElement: HTMLElement, testId: string, selector: string) => {
  const element = within(canvasElement).getByTestId(testId).querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing ${selector} in ${testId}`);
  }
  return element;
};

const layoutProbeSlots = {
  actions: (
    <>
      <span
        aria-hidden="true"
        data-layout-child="first"
        style={{ blockSize: '2rem', display: 'block', flex: '0 0 auto', inlineSize: '6rem' }}
      />
      <span
        aria-hidden="true"
        data-layout-child="second"
        style={{ blockSize: '3rem', display: 'block', flex: '0 0 auto', inlineSize: '6rem' }}
      />
    </>
  ),
};

const layoutProps = (overrides: Record<string, unknown> = {}) =>
  heroSchema.props.parse({
    align: 'start',
    heading: 'Flex layout proof',
    spacing: 'none',
    ...overrides,
  });

const layoutElements = (canvasElement: HTMLElement, testId: string) => {
  const container = proofElement(canvasElement, testId, '[data-mkt-part="actions"]');
  const first = container.querySelector<HTMLElement>('[data-layout-child="first"]');
  const second = container.querySelector<HTMLElement>('[data-layout-child="second"]');
  if (first === null || second === null) {
    throw new Error(`Missing layout probe children in ${testId}`);
  }
  return { container, first, second };
};

const physicalGap = (first: DOMRect, second: DOMRect) =>
  Math.max(first.left, second.left) - Math.min(first.right, second.right);

const inlineSpaces = (container: DOMRect, first: DOMRect, second: DOMRect) => ({
  after: container.right - Math.max(first.right, second.right),
  before: Math.min(first.left, second.left) - container.left,
});

const blockCenter = (rect: DOMRect) => rect.top + rect.height / 2;

const gutterTokenProofStyle = { '--t-gutter': '26px' } as CSSProperties;
const smallGapTokenProofStyle = {
  '--t-gap-sm': '10px',
  inlineSize: '36rem',
} as CSSProperties;

export const ControlRenderingContract: Story = {
  args: Light.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%' }}>
      <div data-testid="hero-eyebrow-absent">
        <Hero
          node={{ ...node, id: 'hero-eyebrow-absent' }}
          props={proofProps({ heading: 'Eyebrow absent' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      <div data-testid="hero-eyebrow-present">
        <Hero
          node={{ ...node, id: 'hero-eyebrow-present' }}
          props={proofProps({ eyebrow: 'New release', heading: 'Eyebrow present' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['start', 'center', 'end'] as const).map((align) => (
        <div key={align} data-testid={`hero-align-${align}`}>
          <Hero
            node={{ ...node, id: `hero-align-${align}` }}
            props={proofProps({ align, heading: `Alignment ${align}` })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['transparent', 'light', 'dark'] as const).map((tone) => (
        <div key={tone} data-testid={`hero-tone-${tone}`}>
          <Hero
            node={{ ...node, id: `hero-tone-${tone}` }}
            props={proofProps({ heading: `Tone ${tone}`, tone })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['none', 'sm', 'md', 'lg'] as const).map((spacing) => (
        <div
          key={spacing}
          data-testid={`hero-spacing-${spacing}`}
          style={spacing === 'lg' ? gutterTokenProofStyle : undefined}
        >
          <Hero
            node={{ ...node, id: `hero-spacing-${spacing}` }}
            props={proofProps({ heading: `Spacing ${spacing}`, spacing })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['narrow', 'standard', 'wide', 'full'] as const).map((width) => (
        <div key={width} data-testid={`hero-width-${width}`}>
          <Hero
            node={{ ...node, id: `hero-width-${width}` }}
            props={proofProps({ heading: `Width ${width}`, width })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('eyebrow paints and changes measured content', async () => {
      const absent = proofElement(
        canvasElement,
        'hero-eyebrow-absent',
        '[data-mkt-part="content"]',
      );
      const present = proofElement(
        canvasElement,
        'hero-eyebrow-present',
        '[data-mkt-part="content"]',
      );
      const eyebrow = proofElement(
        canvasElement,
        'hero-eyebrow-present',
        '[data-mkt-part="eyebrow"]',
      );
      await expect(eyebrow.getBoundingClientRect().height).toBeGreaterThan(0);
      await expect(present.getBoundingClientRect().height).toBeGreaterThan(
        absent.getBoundingClientRect().height,
      );
    });

    await step('logical alignment resolves start, center, and end distinctly', async () => {
      const styles = (['start', 'center', 'end'] as const).map((align) =>
        getComputedStyle(
          proofElement(canvasElement, `hero-align-${align}`, '[data-mkt-part="content"]'),
        ),
      );
      await expect(styles.map((style) => style.textAlign)).toEqual(['start', 'center', 'end']);
      await expect(styles.map((style) => style.alignItems)).toEqual([
        'flex-start',
        'center',
        'flex-end',
      ]);
    });

    await step('tone changes resolved background and foreground paint', async () => {
      const styles = (['transparent', 'light', 'dark'] as const).map((tone) =>
        getComputedStyle(proofElement(canvasElement, `hero-tone-${tone}`, 'section')),
      );
      await expect(new Set(styles.map((style) => style.backgroundColor)).size).toBe(3);
      await expect(styles[1]?.color).not.toBe(styles[2]?.color);
    });

    await step(
      'spacing follows the resolved scale and the content column inherits its gutter',
      async () => {
        const paddings = (['none', 'sm', 'md', 'lg'] as const).map((spacing) =>
          Number.parseFloat(
            getComputedStyle(proofElement(canvasElement, `hero-spacing-${spacing}`, 'section'))
              .paddingBlockStart,
          ),
        );
        await expect(paddings).toEqual([0, 16, 32, 64]);
        const content = proofElement(canvasElement, 'hero-spacing-lg', '[data-mkt-part="content"]');
        const contentStyle = getComputedStyle(content);
        const gutter = Number.parseFloat(contentStyle.getPropertyValue('--t-gutter'));
        await expect(gutter).toBeGreaterThan(0);
        await expect(Number.parseFloat(contentStyle.paddingInlineStart)).toBe(gutter);
      },
    );

    await step(
      'content width constrains the inner wrapper without shrinking the surface',
      async () => {
        const roots = (['narrow', 'standard', 'wide', 'full'] as const).map(
          (width) =>
            proofElement(canvasElement, `hero-width-${width}`, 'section').getBoundingClientRect()
              .width,
        );
        const contents = (['narrow', 'standard', 'wide', 'full'] as const).map(
          (width) =>
            proofElement(
              canvasElement,
              `hero-width-${width}`,
              '[data-mkt-part="content"]',
            ).getBoundingClientRect().width,
        );
        await expect(new Set(roots).size).toBe(1);
        await expect(contents[0] ?? 0).toBeLessThan(contents[3] ?? 0);
        const maxWidths = (['narrow', 'standard', 'wide', 'full'] as const).map(
          (width) =>
            getComputedStyle(
              proofElement(canvasElement, `hero-width-${width}`, '[data-mkt-part="content"]'),
            ).maxInlineSize,
        );
        await expect(new Set(maxWidths).size).toBe(4);
      },
    );
  },
};

export const FlexLayoutRenderingContract: Story = {
  name: 'Flex layout rendering contract',
  args: Light.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%' }}>
      <div data-testid="hero-layout-default" style={smallGapTokenProofStyle}>
        <Hero
          node={{ ...node, id: 'hero-layout-default' }}
          props={heroSchema.props.parse({ align: 'center', heading: 'Legacy defaults' })}
          slots={layoutProbeSlots}
          data={{}}
          isCanvas={false}
        />
      </div>

      {(['row', 'column'] as const).map((layoutDirection) => (
        <div
          key={layoutDirection}
          data-testid={`hero-layout-direction-${layoutDirection}`}
          style={{ inlineSize: '36rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-direction-${layoutDirection}` }}
            props={layoutProps({
              layoutAlign: 'start',
              layoutDirection,
              layoutGap: 'none',
              layoutJustify: 'start',
              layoutWrap: 'nowrap',
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}

      {(['start', 'center', 'end'] as const).map((layoutJustify) => (
        <div
          key={layoutJustify}
          data-testid={`hero-layout-justify-${layoutJustify}`}
          style={{ inlineSize: '36rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-justify-${layoutJustify}` }}
            props={layoutProps({
              layoutAlign: 'start',
              layoutDirection: 'row',
              layoutGap: 'none',
              layoutJustify,
              layoutWrap: 'nowrap',
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}

      {(['start', 'center', 'end'] as const).map((layoutAlign) => (
        <div
          key={layoutAlign}
          data-testid={`hero-layout-align-${layoutAlign}`}
          style={{ inlineSize: '36rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-align-${layoutAlign}` }}
            props={layoutProps({
              layoutAlign,
              layoutDirection: 'row',
              layoutGap: 'none',
              layoutJustify: 'start',
              layoutWrap: 'nowrap',
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}

      {(['none', 'sm', 'md', 'lg'] as const).map((layoutGap) => (
        <div
          key={layoutGap}
          data-testid={`hero-layout-gap-${layoutGap}`}
          style={{ inlineSize: '36rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-gap-${layoutGap}` }}
            props={layoutProps({
              layoutAlign: 'start',
              layoutDirection: 'row',
              layoutGap,
              layoutJustify: 'start',
              layoutWrap: 'nowrap',
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}

      {(['nowrap', 'wrap'] as const).map((layoutWrap) => (
        <div
          key={layoutWrap}
          data-testid={`hero-layout-wrap-${layoutWrap}`}
          style={{ inlineSize: '15rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-wrap-${layoutWrap}` }}
            props={layoutProps({
              layoutAlign: 'start',
              layoutDirection: 'row',
              layoutGap: 'sm',
              layoutJustify: 'start',
              layoutWrap,
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}

      {(['ltr', 'rtl'] as const).map((dir) => (
        <div
          key={dir}
          dir={dir}
          data-testid={`hero-layout-directionality-${dir}`}
          style={{ inlineSize: '36rem' }}
        >
          <Hero
            node={{ ...node, id: `hero-layout-directionality-${dir}` }}
            props={layoutProps({
              layoutAlign: 'start',
              layoutDirection: 'row',
              layoutGap: 'sm',
              layoutJustify: 'start',
              layoutWrap: 'nowrap',
            })}
            slots={layoutProbeSlots}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('omitted layout props retain the tokenised action layout', async () => {
      const { container } = layoutElements(canvasElement, 'hero-layout-default');
      const style = getComputedStyle(container);
      const smallGap = Number.parseFloat(style.getPropertyValue('--t-gap-sm'));
      await expect(style.flexDirection).toBe('row');
      /*
        `wrap`, not the browser's `nowrap`. The old action row applied no
        modifier when a layout prop was omitted and inherited whatever flex
        does by default — which put two CTAs off the side of a phone. The
        current default is stated: an unconfigured row wraps, and its items
        centre on the cross axis so buttons of different heights line up.
      */
      await expect(style.flexWrap).toBe('wrap');
      await expect(style.alignItems).toBe('center');
      await expect(smallGap).toBeGreaterThan(0);
      await expect(Number.parseFloat(style.gap)).toBe(smallGap);
      await expect(style.justifyContent).toBe('center');
    });

    await step('row direction places slot children side by side', async () => {
      const row = layoutElements(canvasElement, 'hero-layout-direction-row');
      const column = layoutElements(canvasElement, 'hero-layout-direction-column');
      const rowFirst = row.first.getBoundingClientRect();
      const rowSecond = row.second.getBoundingClientRect();
      const columnFirst = column.first.getBoundingClientRect();
      const columnSecond = column.second.getBoundingClientRect();

      await expect(Math.abs(rowFirst.top - rowSecond.top)).toBeLessThan(1);
      await expect(rowFirst.right).toBeLessThanOrEqual(rowSecond.left);
      await expect(columnSecond.top).toBeGreaterThanOrEqual(columnFirst.bottom);
      await expect(getComputedStyle(row.container).flexDirection).toBe('row');
      await expect(getComputedStyle(column.container).flexDirection).toBe('column');
    });

    await step('justify moves the child group along the main axis', async () => {
      const positions = (['start', 'center', 'end'] as const).map((layoutJustify) => {
        const { container, first, second } = layoutElements(
          canvasElement,
          `hero-layout-justify-${layoutJustify}`,
        );
        return inlineSpaces(
          container.getBoundingClientRect(),
          first.getBoundingClientRect(),
          second.getBoundingClientRect(),
        );
      });

      await expect(positions[0]?.before ?? 0).toBeLessThan(positions[0]?.after ?? 0);
      await expect(Math.abs((positions[1]?.before ?? 0) - (positions[1]?.after ?? 0))).toBeLessThan(
        1,
      );
      await expect(positions[2]?.before ?? 0).toBeGreaterThan(positions[2]?.after ?? 0);
    });

    await step('align moves the shorter child along the cross axis', async () => {
      const start = layoutElements(canvasElement, 'hero-layout-align-start');
      const center = layoutElements(canvasElement, 'hero-layout-align-center');
      const end = layoutElements(canvasElement, 'hero-layout-align-end');
      const startFirst = start.first.getBoundingClientRect();
      const startSecond = start.second.getBoundingClientRect();
      const centerFirst = center.first.getBoundingClientRect();
      const centerSecond = center.second.getBoundingClientRect();
      const endFirst = end.first.getBoundingClientRect();
      const endSecond = end.second.getBoundingClientRect();

      await expect(Math.abs(startFirst.top - startSecond.top)).toBeLessThan(1);
      await expect(Math.abs(blockCenter(centerFirst) - blockCenter(centerSecond))).toBeLessThan(1);
      await expect(Math.abs(endFirst.bottom - endSecond.bottom)).toBeLessThan(1);
    });

    await step(
      'lg gap is measurably larger than sm gap and every gap resolves a token',
      async () => {
        const gaps = (['none', 'sm', 'md', 'lg'] as const).map((layoutGap) => {
          const { first, second } = layoutElements(canvasElement, `hero-layout-gap-${layoutGap}`);
          return physicalGap(first.getBoundingClientRect(), second.getBoundingClientRect());
        });
        /*
          The PAGE scale, read from the theme the block actually consumes — not
          the editor's own spacing scale, which is a different vocabulary with
          different values (6px where the page says 8px).
        */
        const themed = canvasElement.querySelector('[data-page-theme]');
        const scale = getComputedStyle(themed ?? canvasElement);
        const tokenValues = ['--t-space-0', '--t-gap-sm', '--t-gap', '--t-gap-lg'].map((token) =>
          token === '--t-space-0' ? 0 : Number.parseFloat(scale.getPropertyValue(token)),
        );

        await expect(gaps[1] ?? 0).toBeGreaterThan(0);
        await expect(gaps[3] ?? 0).toBeGreaterThan(gaps[1] ?? 0);
        await expect(gaps[3] ?? 0).not.toBe(gaps[1] ?? 0);
        for (const [index, gap] of gaps.entries()) {
          await expect(gap).toBeCloseTo(tokenValues[index] ?? Number.NaN, 1);
        }
      },
    );

    await step('wrap moves a child onto a new line at a narrow inline size', async () => {
      const nowrap = layoutElements(canvasElement, 'hero-layout-wrap-nowrap');
      const wrap = layoutElements(canvasElement, 'hero-layout-wrap-wrap');
      const nowrapFirst = nowrap.first.getBoundingClientRect();
      const nowrapSecond = nowrap.second.getBoundingClientRect();
      const wrapContainer = wrap.container.getBoundingClientRect();
      const wrapFirst = wrap.first.getBoundingClientRect();
      const wrapSecond = wrap.second.getBoundingClientRect();
      const wrapGap = Number.parseFloat(getComputedStyle(wrap.container).columnGap);

      await expect(Math.abs(nowrapFirst.top - nowrapSecond.top)).toBeLessThan(1);
      await expect(wrapFirst.width + wrapSecond.width + wrapGap).toBeGreaterThan(
        wrapContainer.width,
      );
      await expect(wrapSecond.top).toBeGreaterThanOrEqual(wrapFirst.bottom);
      await expect(wrapContainer.height).toBeGreaterThan(wrapSecond.height);
      await expect(getComputedStyle(nowrap.container).flexWrap).toBe('nowrap');
      await expect(getComputedStyle(wrap.container).flexWrap).toBe('wrap');
    });

    await step('row start mirrors child order and edge offsets under RTL', async () => {
      const ltr = layoutElements(canvasElement, 'hero-layout-directionality-ltr');
      const rtl = layoutElements(canvasElement, 'hero-layout-directionality-rtl');
      const ltrContainer = ltr.container.getBoundingClientRect();
      const rtlContainer = rtl.container.getBoundingClientRect();
      const ltrFirst = ltr.first.getBoundingClientRect();
      const ltrSecond = ltr.second.getBoundingClientRect();
      const rtlFirst = rtl.first.getBoundingClientRect();
      const rtlSecond = rtl.second.getBoundingClientRect();

      await expect(ltrFirst.left).toBeLessThan(ltrSecond.left);
      await expect(rtlFirst.left).toBeGreaterThan(rtlSecond.left);
      await expect(Math.abs(ltrFirst.left - ltrContainer.left)).toBeLessThan(1);
      await expect(Math.abs(rtlContainer.right - rtlFirst.right)).toBeLessThan(1);
      await expect(
        Math.abs(ltrSecond.left - ltrContainer.left - (rtlContainer.right - rtlSecond.right)),
      ).toBeLessThan(1);
    });
  },
};

/**
 * The proof that a published page still has geometry.
 *
 * `--t-*` is written by exactly one thing in the product — `CanvasFrame`, into
 * the editor's preview frame — and for a long time publishing wrote none. That
 * was invisible while each block shipped a stylesheet reading
 * `var(--t-space-unit, 4px)`: the fallbacks in those files were holding every
 * published page together. The Tailwind migration deleted the stylesheets and
 * with them every fallback, and this block measured 0px where it needs 64.
 *
 * The theme bridge carries the fallbacks now, and `StaticDocument` publishes
 * the document's own design system on top of them. This story guards the
 * floor: strip the tokens and the page must still lay out.
 *
 * It is deliberately NOT a check that the numbers equal the starter theme —
 * that would fail every time somebody tunes a default. What must never happen
 * is a section with no padding, a column with no width, and buttons touching.
 */
export const UnthemedPublishContract: Story = {
  args: Light.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ ...unthemedStyle(), inlineSize: '60rem' }} data-testid="unthemed">
      <Hero
        node={{ ...node, id: 'hero-unthemed' }}
        props={heroSchema.props.parse({
          heading: 'Published without a design system',
          body: 'Every length here comes from a fallback in the theme bridge.',
          spacing: 'lg',
          width: 'standard',
          gutter: 'md',
        })}
        slots={{
          actions: (
            <>
              <button type="button">Primary</button>
              <button type="button">Secondary</button>
            </>
          ),
        }}
        data={{}}
        isCanvas={false}
      />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const root = within(canvasElement).getByTestId('unthemed');
    const section = root.querySelector('section');
    const content = root.querySelector<HTMLElement>('[data-mkt-part="content"]');
    const copy = root.querySelector<HTMLElement>('[data-mkt-part="copy"]');
    const actions = root.querySelector<HTMLElement>('[data-mkt-part="actions"]');
    if (section === null || content === null || copy === null || actions === null) {
      throw new Error('Expected the hero to render its section, column, copy stack and action row');
    }

    await step('the tokens really are gone', async () => {
      /*
        Without this the story would pass just as well against a themed page,
        and would be proving nothing about the fallback.
      */
      await expect(getComputedStyle(root).getPropertyValue('--t-gap-lg').trim()).toBe('');
      await expect(getComputedStyle(root).getPropertyValue('--t-space-unit').trim()).toBe('');
    });

    await step('the section still has its rhythm', async () => {
      const style = getComputedStyle(section);
      await expect(Number.parseFloat(style.paddingBlockStart)).toBeGreaterThan(0);
      await expect(Number.parseFloat(style.paddingBlockEnd)).toBeGreaterThan(0);
    });

    await step('the column still has a width and a gutter', async () => {
      const style = getComputedStyle(content);
      await expect(style.maxWidth).not.toBe('none');
      await expect(Number.parseFloat(style.maxWidth)).toBeGreaterThan(0);
      await expect(Number.parseFloat(style.paddingInlineStart)).toBeGreaterThan(0);
      /*
        The rhythm between eyebrow, headline, body and actions lives on the
        COPY stack (`gap-6`), not on the outer column, which holds a single
        child and has never had a gap. This step used to read `rowGap` off
        `content`, got `normal`, parsed it to NaN, and failed on every Chromium
        run — a stale story, not a collapsed page. Measured where the gap is.
      */
      await expect(Number.parseFloat(getComputedStyle(copy).rowGap)).toBeGreaterThan(0);
    });

    await step('the buttons are not touching', async () => {
      const [first, second] = [...actions.children] as HTMLElement[];
      if (first === undefined || second === undefined) {
        throw new Error('Expected two actions');
      }
      const gap = second.getBoundingClientRect().left - first.getBoundingClientRect().right;
      await expect(gap).toBeGreaterThan(0);
    });
  },
};
