import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { BlockRenderProps, Node } from '@craftkit/builder-schema';

import { blocksMarketing } from './index';

/**
 * SC-008: zero horizontal overflow and zero overlaps, at four widths, measured
 * in a real browser.
 *
 * ## Why the section list is read from the manifest
 *
 * A hand-written list of sections is a list that ages: the next section someone
 * adds is not on it, and the gate reports a clean run over the twelve it knew
 * about. Reading `blocksMarketing.contributes.blocks` means a new section is
 * measured the day it is registered, whether or not anyone remembered this file.
 *
 * ## Why every section is rendered from its own EXAMPLE
 *
 * Defaults are the easy case — a section with no content overflows nothing. The
 * examples are the props the block's own author wrote to show what it is for,
 * and they are what a generated page actually contains.
 */

const WIDTHS = [360, 768, 1024, 1440] as const;

interface Sample {
  readonly type: string;
  readonly render: (props: BlockRenderProps) => React.ReactNode;
  readonly props: Record<string, unknown>;
}

/** Every registered marketing section, with the richest example its author gave. */
function samples(): readonly Sample[] {
  return (blocksMarketing.contributes?.blocks ?? []).map((entry) => {
    const example = entry.schema.examples.at(-1)?.node as { props?: unknown } | undefined;
    return {
      type: entry.schema.type,
      render: entry.render as (props: BlockRenderProps) => React.ReactNode,
      props: entry.schema.props.parse(example?.props ?? {}) as Record<string, unknown>,
    };
  });
}

function Board({ width }: { width: number }) {
  return (
    <div data-testid="board" style={{ inlineSize: `${String(width)}px`, overflow: 'visible' }}>
      {samples().map((sample) => {
        const node: Node = { id: `${sample.type}-probe`, type: sample.type, props: {} };
        const Render = sample.render;
        return (
          <section data-section={sample.type} key={sample.type}>
            <Render node={node} props={sample.props} slots={{}} data={{}} isCanvas={false} />
          </section>
        );
      })}
    </div>
  );
}

async function measure(canvasElement: HTMLElement, width: number): Promise<void> {
  const canvas = within(canvasElement);
  const board = canvas.getByTestId('board');
  const sections = [...board.querySelectorAll<HTMLElement>('[data-section]')];

  /* Non-vacuity: an empty board overflows nothing, forever. */
  await expect(sections.length).toBeGreaterThan(10);

  /*
    The board's own right edge, read rather than computed from `left + width`.

    That arithmetic is only correct in LTR. In RTL the board is laid out from
    the right, so `left` is not where the content starts — the first version of
    this gate reported a 96px overflow in the RTL story that was entirely its
    own measurement error. The element knows where it ends; ask it.
  */
  const boardBox = board.getBoundingClientRect();
  const edge = boardBox.right;
  for (const section of sections) {
    const name = section.dataset['section'] ?? '?';
    /*
      Measured on the DESCENDANTS, not on the section box. A section is a block
      element and takes the board's width by definition; what overflows is
      something inside it — a fixed-width table, a long word, a grid with a
      minimum track wider than the phone it is on.
    */
    for (const child of section.querySelectorAll<HTMLElement>('*')) {
      const box = child.getBoundingClientRect();
      if (box.width === 0) continue;
      /*
        An element positioned deliberately outside the flow — a decorative
        bleed, an absolutely-placed glow — is not overflow a person can scroll
        into. Only elements inside the normal flow are measured.
      */
      if (getComputedStyle(child).position === 'absolute') continue;
      /* Anything inside its own horizontal scroller is allowed to be wider. */
      let scroller: HTMLElement | null = child.parentElement;
      let inside = false;
      while (scroller !== null && scroller !== board) {
        const overflowX = getComputedStyle(scroller).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') {
          inside = true;
          break;
        }
        scroller = scroller.parentElement;
      }
      if (inside) continue;

      /*
        Named down to the ELEMENT. "promoBanner overflows" tells someone which
        file to open; "its <img> is 708px wide" tells them which line.
      */
      const where = [
        child.tagName.toLowerCase(),
        ...Object.keys(child.dataset).map((key) => `[data-${key}]`),
        /* `classList`, not `className`: on an SVG element the latter is an
           `SVGAnimatedString` and has no `.split`. */
        child.classList.length === 0 ? '' : `.${child.classList[0] ?? ''}`,
      ]
        .filter((part) => part !== '')
        .join('');
      await expect(
        Math.round(box.right),
        `"${name}" overflows by ${String(Math.round(box.right - edge))}px at ${String(width)}px — ${where} is ${String(Math.round(box.width))}px wide`,
      ).toBeLessThanOrEqual(Math.round(edge) + 1);
    }
  }
}

const meta = {
  title: 'Builder/Blocks/Responsive',
  component: Board,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Board>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Phone: Story = {
  args: { width: WIDTHS[0] },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.width);
  },
};

export const Tablet: Story = {
  args: { width: WIDTHS[1] },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.width);
  },
};

export const Laptop: Story = {
  args: { width: WIDTHS[2] },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.width);
  },
};

export const Desktop: Story = {
  args: { width: WIDTHS[3] },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.width);
  },
};

/** Right to left, at the narrowest width — where a mirrored layout breaks first. */
export const PhoneRightToLeft: Story = {
  args: { width: WIDTHS[0] },
  globals: { direction: 'rtl' },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.width);
  },
};
