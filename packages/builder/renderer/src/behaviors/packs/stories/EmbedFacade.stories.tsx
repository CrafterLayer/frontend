import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef } from 'react';
import { expect, waitFor } from 'storybook/test';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { CustomCode } from '../../../components/CustomCode/CustomCode';
import { mountEmbedFacade } from '../embed-facade';
import { VIDEO_PACK_CSS } from '../video-css';

function facadeTree(href: string, label: string, poster: string): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'a',
        className: 'group relative block aspect-video overflow-hidden rounded-xl bg-black',
        attributes: { 'data-ck-behavior': 'embed-facade', href, 'aria-label': label },
        children: [
          {
            kind: 'element',
            tag: 'img',
            className: 'size-full object-cover',
            attributes: { src: poster, alt: '', loading: 'lazy', decoding: 'async' },
          },
          { kind: 'element', tag: 'span', className: 'ck-play-badge', attributes: { 'aria-hidden': 'true' } },
        ],
      },
    ],
  };
}

const VIDEO_ID = 'aqz-KE-bpKQ';
const POSTER = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`;

interface StageProps {
  readonly tree: CustomCodeRoot;
  readonly locale: 'ar' | 'en';
  readonly isCanvas?: boolean;
}

/*
  The play tests never click the facade: a click loads the real player. They
  check the facade is armed and that nothing was requested before the click.
*/
function EmbedFacadeStage({ tree, locale, isCanvas = false }: StageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const region = ref.current;
    if (region === null) return undefined;
    return mountEmbedFacade(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  return (
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={{ maxInlineSize: 640 }}>
      <style>{VIDEO_PACK_CSS}</style>
      <div ref={ref}>
        <CustomCode hostId="embed-facade-story" tree={tree} isCanvas={isCanvas} />
      </div>
    </div>
  );
}

const meta = {
  title: 'Builder/Renderer/Behaviors/EmbedFacade',
  component: EmbedFacadeStage,
  parameters: { layout: 'padded' },
  args: {
    tree: facadeTree(`https://www.youtube.com/watch?v=${VIDEO_ID}`, 'Play: Big Buck Bunny', POSTER),
    locale: 'en',
  },
} satisfies Meta<typeof EmbedFacadeStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A YouTube link with a poster: armed, and no player frame until the reader clicks. */
export const English: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('a')?.getAttribute('data-ck-facade')).toBe(''));
    await expect(canvasElement.querySelector('iframe')).toBeNull();
  },
};

/** An Arabic page; the iframe, once clicked, takes its title from the link's label. */
export const Arabic: Story = {
  args: {
    tree: facadeTree(`https://youtu.be/${VIDEO_ID}`, 'شغّل: الأرنب الكبير', POSTER),
    locale: 'ar',
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('a')?.hasAttribute('data-ck-facade')).toBe(true));
    await expect(canvasElement.querySelector('iframe')).toBeNull();
  },
};

/** A Google Maps place: the click swaps in the keyless map embed. */
export const GoogleMap: Story = {
  args: {
    tree: facadeTree(
      'https://www.google.com/maps?q=%D8%A8%D8%B1%D8%AC%20%D8%AE%D9%84%D9%8A%D9%81%D8%A9',
      'خريطة: برج خليفة',
      // A photo-catalog entry (Pexels): the Dubai skyline.
      'https://images.pexels.com/photos/33687811/pexels-photo-33687811.jpeg?auto=compress&cs=tinysrgb&w=1600',
    ),
    locale: 'ar',
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('a')?.hasAttribute('data-ck-facade')).toBe(true));
  },
};

/** On the editing canvas a click selects: the facade is marked still and never swaps. */
export const Canvas: Story = {
  args: { isCanvas: true },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('a')?.getAttribute('data-ck-facade')).toBe('still'));
  },
};
