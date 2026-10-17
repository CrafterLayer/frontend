import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { Locale, RowState } from '../../model/view-types';
import { clinicRows, PARALLEL_STATES } from '../../testing/wp-15-history-phone-fixtures';

import { MiniSpine, type MiniSpineProps } from './MiniSpine';

/* ── The phone's mini row, as SheetMiniBar lays the spine out ─────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  /** The phone's width: 390 (SPEC §3.16). */
  readonly width?: number;
}

/**
 * One phone-width frame per story: the theme, the language and direction, and the mini
 * row's 16px gutters, so the spine spans exactly the width it spans in the sheet. A story
 * picks its frame with `parameters.panel`.
 */
const inPhone: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 390 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        paddingBlock: 'var(--bldr-space-3xl)',
        paddingInline: 'var(--bldr-space-3xl)',
        boxSizing: 'border-box',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
      }}
    >
      <Story />
    </div>
  );
};

/* ── What every spine must be (SPEC §4.19) ───────────────────────────────── */

function spineOf(canvasElement: HTMLElement): HTMLElement {
  const spine = canvasElement.querySelector<HTMLElement>('.ck-agent-mini-spine');
  if (spine === null) throw new Error('no mini spine');
  return spine;
}

/** Hidden from assistive technology, nothing in it to press, 4px tall, segments 2px apart. */
async function expectQuietSpine(canvasElement: HTMLElement, segments: number): Promise<void> {
  const spine = spineOf(canvasElement);
  await expect(spine).toHaveAttribute('aria-hidden', 'true');
  await expect(spine.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
  const parts = [...spine.querySelectorAll<HTMLElement>('.ck-agent-mini-spine__segment')];
  await expect(parts).toHaveLength(segments);
  await expect(Math.round(spine.getBoundingClientRect().height)).toBe(4);
  const [first, second] = parts;
  if (first !== undefined && second !== undefined) {
    const a = first.getBoundingClientRect();
    const b = second.getBoundingClientRect();
    await expect(Math.round(Math.min(Math.abs(b.left - a.right), Math.abs(a.left - b.right)))).toBe(
      2,
    );
  }
}

/** Page order runs in the reading direction: in Arabic the first section is at the right. */
async function expectReadingOrder(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const parts = [...spineOf(canvasElement).querySelectorAll('.ck-agent-mini-spine__segment')];
  const first = parts[0]?.getBoundingClientRect();
  const last = parts.at(-1)?.getBoundingClientRect();
  if (first === undefined || last === undefined) throw new Error('no segments');
  if (locale === 'ar') await expect(first.left).toBeGreaterThan(last.left);
  else await expect(first.left).toBeLessThan(last.left);
}

const ALL_LANDED: readonly RowState[] = Array<RowState>(8).fill('landed');

const meta = {
  title: 'Agent/Phone/MiniSpine',
  component: MiniSpine,
  parameters: { layout: 'centered' },
  args: { rows: clinicRows('en', PARALLEL_STATES), live: true },
  decorators: [inPhone],
} satisfies Meta<typeof MiniSpine>;

export default meta;
type Story = StoryObj<typeof meta>;

function parallel(locale: Locale, theme: 'light' | 'dark' = 'light'): Story {
  const args: MiniSpineProps = { rows: clinicRows(locale, PARALLEL_STATES), live: true };
  return {
    args,
    parameters: { panel: { locale, theme } },
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    play: async ({ canvasElement }) => {
      await expectQuietSpine(canvasElement, 8);
      await expectReadingOrder(canvasElement, locale);
    },
  };
}

/**
 * The §3.16 mini frame: 1 section on the page (ink), four writers lit at once, one draft
 * waiting its turn (still Halo), two waiting in pencil. Ink grows from the reading start.
 */
export const Parallel: Story = parallel('en');
export const ParallelDark: Story = parallel('en', 'dark');
export const ParallelRightToLeft: Story = parallel('ar');
export const ParallelRightToLeftDark: Story = parallel('ar', 'dark');

/** The skeleton pass: no section exists yet, so one lit track makes no claim of a count. */
export const Skeleton: Story = {
  args: { indeterminate: true, live: true, rows: [] },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 1);
    await expect(spineOf(canvasElement)).toHaveAttribute('data-indeterminate');
  },
};

export const SkeletonDark: Story = {
  ...Skeleton,
  parameters: { panel: { theme: 'dark' } },
};

/**
 * A section lands: its segment fills with ink from the reading start over 360ms (SPEC §5
 * moment 1). Four of eight on the page, the fifth being written.
 */
export const Landing: Story = {
  args: {
    rows: clinicRows('en', [
      'landed',
      'landed',
      'landed',
      'landed',
      'writing',
      'drafted',
      'waiting',
      'waiting',
    ]),
    live: true,
    animate: true,
  },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
    await expect(spineOf(canvasElement)).not.toHaveAttribute('data-complete');
  },
};

/** The page is whole: one unbroken ink stroke, swept once by a light (SPEC §5 moment 5). */
export const Complete: Story = {
  args: { rows: clinicRows('en', ALL_LANDED), animate: true },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
    await expect(spineOf(canvasElement)).toHaveAttribute('data-complete');
  },
};

export const CompleteRightToLeftDark: Story = {
  args: { rows: clinicRows('ar', ALL_LANDED), animate: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
    await expect(spineOf(canvasElement)).toHaveAttribute('data-complete');
  },
};

/** Built with one failure: the failed section is a dashed Alarm segment, never ink. */
export const Partial: Story = {
  args: {
    rows: clinicRows('en', [
      'landed',
      'landed',
      'landed',
      'landed',
      'failed',
      'landed',
      'landed',
      'landed',
    ]),
  },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
    await expect(spineOf(canvasElement)).not.toHaveAttribute('data-complete');
  },
};

export const PartialDark: Story = { ...Partial, parameters: { panel: { theme: 'dark' } } };

/** Stopped after three sections: the rest were never written, and stay pencil. */
export const Stopped: Story = {
  args: {
    rows: clinicRows('en', [
      'landed',
      'landed',
      'landed',
      'notWritten',
      'notWritten',
      'notWritten',
      'notWritten',
      'notWritten',
    ]),
  },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
  },
};

/** The build was undone: nothing of it is on the page, so nothing is ink. */
export const Undone: Story = {
  args: { rows: clinicRows('en', Array<RowState>(8).fill('undone')) },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 8);
  },
};

/** The page in miniature: twelve sections draw twelve short strokes in the same width. */
export const TwelveSections: Story = {
  args: {
    rows: clinicRows('en', [
      ...Array<RowState>(5).fill('landed'),
      'writing',
      'writing',
      'drafted',
      ...Array<RowState>(4).fill('waiting'),
    ]),
    live: true,
  },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 12);
  },
};

/** ...and three sections draw three long ones. */
export const ThreeSections: Story = {
  args: { rows: clinicRows('ar', ['landed', 'writing', 'waiting']), live: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expectQuietSpine(canvasElement, 3);
    await expectReadingOrder(canvasElement, 'ar');
  },
};
