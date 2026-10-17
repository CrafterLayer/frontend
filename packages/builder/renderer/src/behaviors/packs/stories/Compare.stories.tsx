import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, fireEvent, within } from 'storybook/test';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountCompare } from '../compare';
import { WIDGETS_PACK_CSS } from '../widgets-css';

const PHOTO = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=960&h=640&fit=crop';

function compareTree(before: string, after: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'div',
        attributes: { 'data-ck-behavior': 'compare' },
        children: [
          {
            kind: 'element',
            tag: 'img',
            attributes: { src: `${PHOTO}&sat=-100`, alt: before, width: '960', height: '640' },
          },
          {
            kind: 'element',
            tag: 'img',
            attributes: { src: PHOTO, alt: after, width: '960', height: '640' },
          },
        ],
      },
    ],
  };
}

interface StageProps {
  readonly tree: CustomCodeRoot;
  readonly locale: 'ar' | 'en';
  readonly isCanvas?: boolean;
}

/*
  The pack is mounted here, in a LAYOUT effect: it runs before CustomCode's own
  (passive) behaviour effect, so once the renderer seam mounts every pack on
  the region too, the pack's per-element guard keeps it to one mount.
*/
function CompareStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    return mountCompare(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  return (
    <div
      ref={ref}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{ maxInlineSize: 640 }}
    >
      <style>{WIDGETS_PACK_CSS}</style>
      <CustomCode hostId="compare-story" tree={tree} isCanvas={isCanvas} />
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/Compare',
  component: CompareStage,
  parameters: { layout: 'padded' },
  args: { tree: compareTree('Before', 'After'), locale: 'en' },
} satisfies Meta<typeof CompareStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A before/after pair: the slider starts at the middle and follows the pointer or the keys. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole<HTMLInputElement>('slider', { name: 'Before / after' });
    await expect(slider).toHaveAttribute('aria-valuetext', '50%');
    const host = canvasElement.querySelector<HTMLElement>("[data-ck-behavior='compare']");
    await fireEvent.input(slider, { target: { value: '25' } });
    await expect(host?.style.getPropertyValue('--ck-compare')).toBe('25%');
    await expect(slider).toHaveAttribute('aria-valuetext', '25%');
  },
};

/**
 * The same pair on an Arabic page: the label is «قبل / بعد», the value reads in
 * Arabic-Indic digits, and the after image is clipped from the right — the
 * inline start — so the divider sits under the native RTL thumb.
 */
export const Arabic: Story = {
  args: { tree: compareTree('قبل', 'بعد'), locale: 'ar' },
  play: async ({ canvasElement }) => {
    const slider = within(canvasElement).getByRole('slider', { name: 'قبل / بعد' });
    await expect(slider.getAttribute('aria-valuetext')).toContain('٥٠');
    const after = canvasElement.querySelectorAll('img')[1];
    if (after === undefined) throw new Error('the after image did not render');
    await expect(getComputedStyle(after).clipPath).toContain('inset(0px 50% 0px 0px)');
  },
};

/** On the editing canvas: drawn at the middle and inert, so a click selects the element. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    const slider = canvasElement.querySelector<HTMLInputElement>('[data-ck-compare-range]');
    if (slider === null) throw new Error('the slider did not mount');
    await expect(slider.tabIndex).toBe(-1);
    await expect(slider.style.pointerEvents).toBe('none');
  },
};
