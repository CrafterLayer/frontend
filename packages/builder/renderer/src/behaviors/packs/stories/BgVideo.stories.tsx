import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, userEvent, waitFor } from 'storybook/test';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountBgVideo } from '../bg-video';
import { VIDEO_PACK_CSS } from '../video-css';

/* A CC0 clip from MDN's interactive examples. */
const CLIP = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

function heroTree(heading: string, line: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        className: 'relative isolate overflow-hidden rounded-xl bg-black px-8 py-24 text-white',
        attributes: { 'data-ck-behavior': 'bg-video' },
        children: [
          {
            kind: 'element',
            tag: 'video',
            className: 'absolute inset-0 -z-10 size-full object-cover opacity-70',
            attributes: { muted: '', loop: '', playsinline: '', preload: 'metadata', 'aria-hidden': 'true' },
            children: [{ kind: 'element', tag: 'source', attributes: { src: CLIP, type: 'video/mp4' } }],
          },
          { kind: 'element', tag: 'h2', className: 'text-3xl font-bold', text: heading },
          { kind: 'element', tag: 'p', className: 'mt-2 text-lg', text: line },
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

function BgVideoStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    return mountBgVideo(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxInlineSize: 720 }}>
      <style>{VIDEO_PACK_CSS}</style>
      <div ref={ref}>
        <CustomCode hostId="bg-video-story" tree={tree} isCanvas={isCanvas} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/BgVideo',
  component: BgVideoStage,
  parameters: { layout: 'padded' },
  args: { tree: heroTree('Fresh every morning', 'Bread from our oven, since 1998.'), locale: 'en' },
} satisfies Meta<typeof BgVideoStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The toggle sits at the inline end; pressing it stops the background and relabels itself. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    const toggle = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLButtonElement>('.ck-bgv-toggle');
      if (found === null) throw new Error('no toggle yet');
      return found;
    });
    await expect(toggle.getAttribute('aria-label')).toBe('Pause background');
    await userEvent.click(toggle);
    await expect(toggle.getAttribute('aria-label')).toBe('Play background');
    await expect(canvasElement.querySelector('video')?.paused).toBe(true);
  },
};

/** Arabic labels; the toggle sits at the bottom left, the inline end of an RTL section. */
export const Arabic: Story = {
  args: { tree: heroTree('طازج كل صباح', 'خبز من فرننا منذ ١٩٩٨.'), locale: 'ar' },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('.ck-bgv-toggle')?.getAttribute('aria-label')).toBe('إيقاف الخلفية'),
    );
  },
};

/** On the editing canvas the poster stays: nothing plays and no toggle is drawn. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('section')?.getAttribute('data-ck-bg-video')).not.toBeNull(),
    );
    await expect(canvasElement.querySelector('.ck-bgv-toggle')).toBeNull();
  },
};
