import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, waitFor } from 'storybook/test';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { VIDEO_PACK_CSS } from '../video-css';
import { mountVideoPlayer } from '../video-player';

/* A CC0 clip from MDN's interactive examples. */
const CLIP = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

function playerTree(title: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'figure',
        className: 'relative aspect-video overflow-hidden rounded-xl bg-black',
        attributes: { 'data-ck-behavior': 'video-player' },
        children: [
          {
            kind: 'element',
            tag: 'video',
            className: 'block size-full object-cover',
            attributes: { controls: '', playsinline: '', preload: 'metadata' },
            children: [{ kind: 'element', tag: 'source', attributes: { src: CLIP, type: 'video/mp4' } }],
          },
          {
            kind: 'element',
            tag: 'figcaption',
            className:
              'pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 text-sm font-semibold text-white',
            text: title,
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
  The pack mounts on the region in a layout effect, the way the renderer seam
  mounts every pack; the styles come from VIDEO_PACK_CSS directly.
*/
function VideoPlayerStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    return mountVideoPlayer(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxInlineSize: 640 }}>
      <style>{VIDEO_PACK_CSS}</style>
      <div ref={ref}>
        <CustomCode hostId="video-player-story" tree={tree} isCanvas={isCanvas} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/VideoPlayer',
  component: VideoPlayerStage,
  parameters: { layout: 'padded' },
  args: { tree: playerTree('A flower opens'), locale: 'en' },
} satisfies Meta<typeof VideoPlayerStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** English labels; the native controls give way to the pack's chrome. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    const video = canvasElement.querySelector('video');
    await waitFor(() => expect(canvasElement.querySelector('.ck-vp-bar')).not.toBeNull());
    await expect(video?.hasAttribute('controls')).toBe(false);
    await expect(canvasElement.querySelector('.ck-vp-play')?.getAttribute('aria-label')).toBe('Play');
    await expect(canvasElement.querySelector('.ck-vp-seek')?.getAttribute('aria-label')).toBe('Seek');
  },
};

/** Arabic labels, Arabic-Indic digits, and the bar laid out right to left. */
export const Arabic: Story = {
  args: { tree: playerTree('زهرة تتفتح'), locale: 'ar' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.ck-vp-bar')).not.toBeNull());
    await expect(canvasElement.querySelector('.ck-vp-play')?.getAttribute('aria-label')).toBe('تشغيل');
    await expect(canvasElement.querySelector('.ck-vp-time')?.textContent).toMatch(/^٠:٠٠ \/ /u);
  },
};

/** On the editing canvas the chrome is drawn but inert, so a click selects. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.ck-vp')).not.toBeNull());
    await expect(canvasElement.querySelector('.ck-vp')?.hasAttribute('inert')).toBe(true);
    await expect(canvasElement.querySelector('figure')?.getAttribute('data-ck-player')).toBe('still');
  },
};
