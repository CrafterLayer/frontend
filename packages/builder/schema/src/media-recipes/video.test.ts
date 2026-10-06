import { describe, expect, it } from 'vitest';

import type { CustomCodeElement, CustomCodeNode } from '../custom-code/custom-code-tree';
import { mediaRecipeProblems } from './checks';
import { isMediaRecipeError, mediaRecipeNode, type MediaLocale, type MediaRecipeResult } from './types';
import {
  buildBgVideoLayer,
  buildVideoFacade,
  buildVideoPlayer,
  buildVideoSection,
} from './video';

const LOCALES: readonly MediaLocale[] = ['ar', 'en'];
const POSTER = { src: 'https://images.example.com/poster.jpg', alt: 'مقهى', width: 1600, height: 900 };

function recipe(result: MediaRecipeResult) {
  if (isMediaRecipeError(result)) throw new Error(result.error);
  return result;
}

function find(node: CustomCodeNode, tag: string): CustomCodeElement | undefined {
  if (node.kind === 'element' && node.tag === tag) return node;
  for (const child of node.kind === 'icon' ? [] : (node.children ?? [])) {
    const found = find(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe('video recipes', () => {
  it('every builder output passes the door, in Arabic and English', () => {
    for (const locale of LOCALES) {
      const outputs = [
        buildVideoPlayer(locale, {
          src: 'https://cdn.example.com/clip.mp4',
          type: 'video/mp4',
          poster: POSTER,
          captions: 'https://cdn.example.com/ar.vtt',
          title: 'جولة في المطبخ',
        }),
        buildVideoFacade(locale, { video: { kind: 'youtube', id: 'dQw4w9WgXcQ' }, title: 'Our story' }),
        buildVideoFacade(locale, { video: { kind: 'vimeo', id: '76979871' } }),
        buildBgVideoLayer({ src: '/uploads/hero.webm', type: 'video/webm', poster: POSTER.src }),
        buildVideoSection(locale, { url: 'https://youtu.be/dQw4w9WgXcQ', title: 'قصتنا' }),
        buildVideoSection(locale, { url: 'https://cdn.example.com/clip.mp4', poster: POSTER, title: 'Tour' }),
        buildVideoSection(locale, {
          mode: 'background',
          url: 'https://cdn.example.com/clip.mp4',
          poster: POSTER,
          title: 'أهلًا بكم',
          text: 'قهوة مختصة منذ ٢٠١٠',
        }),
      ];
      for (const output of outputs) {
        const built = recipe(output);
        expect(mediaRecipeProblems(built), JSON.stringify(built.tree)).toEqual([]);
        expect(built.label.ar).not.toBe('');
        expect(built.label.en).not.toBe('');
      }
    }
  });

  it('the player keeps native controls for the no-script view and names the behaviour', () => {
    const figure = mediaRecipeNode(
      recipe(
        buildVideoPlayer('ar', {
          src: 'https://cdn.example.com/clip.mp4',
          type: 'video/mp4',
          captions: { src: 'https://cdn.example.com/en.vtt', srclang: 'en' },
        }),
      ),
    );
    expect(figure.tag).toBe('figure');
    expect(figure.attributes?.['data-ck-behavior']).toBe('video-player');
    const video = find(figure, 'video');
    expect(video?.attributes).toMatchObject({ controls: '', playsinline: '', preload: 'metadata' });
    expect(video?.attributes?.autoplay).toBeUndefined();
    expect(find(figure, 'source')?.attributes).toEqual({
      src: 'https://cdn.example.com/clip.mp4',
      type: 'video/mp4',
    });
    expect(find(figure, 'track')?.attributes).toMatchObject({ kind: 'captions', srclang: 'en' });
  });

  it('the facade is a link to the video page with an Arabic or English play label', () => {
    const ar = mediaRecipeNode(recipe(buildVideoFacade('ar', { video: { kind: 'youtube', id: 'dQw4w9WgXcQ' }, title: 'قصتنا' })));
    expect(ar.tag).toBe('a');
    expect(ar.attributes).toMatchObject({
      'data-ck-behavior': 'embed-facade',
      href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'aria-label': 'شغّل: قصتنا',
    });
    expect(find(ar, 'img')?.attributes).toMatchObject({
      src: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      alt: '',
      loading: 'lazy',
    });
    const en = mediaRecipeNode(recipe(buildVideoFacade('en', { video: { kind: 'vimeo', id: '76979871' } })));
    expect(en.attributes?.href).toBe('https://vimeo.com/76979871');
    expect(en.attributes?.['aria-label']).toBe('Play: the video');
    expect(find(en, 'img')).toBeUndefined();
  });

  it('the background layer never autoplays: the runtime plays it in view, motion allowed', () => {
    const video = mediaRecipeNode(recipe(buildBgVideoLayer({ src: '/uploads/hero.mp4', type: 'video/mp4' })));
    expect(video.tag).toBe('video');
    expect(video.attributes).toMatchObject({ muted: '', loop: '', playsinline: '', 'aria-hidden': 'true' });
    expect(video.attributes?.autoplay).toBeUndefined();
    const section = mediaRecipeNode(
      recipe(buildVideoSection('ar', { mode: 'background', url: '/uploads/hero.mp4', title: 'مرحبا' })),
    );
    expect(section.attributes).toMatchObject({ 'data-ck-behavior': 'bg-video', lang: 'ar', dir: 'rtl' });
    expect(section.children?.[0]).toMatchObject({ kind: 'element', tag: 'video' });
  });

  it('a section routes YouTube to the facade and refuses what it cannot play, with repair text', () => {
    const facade = mediaRecipeNode(recipe(buildVideoSection('en', { url: 'https://youtu.be/dQw4w9WgXcQ' })));
    expect(find(facade, 'a')?.attributes?.['data-ck-behavior']).toBe('embed-facade');
    expect(buildVideoSection('en', { url: 'https://cdn.example.com/live.m3u8' })).toEqual({
      error: 'HLS needs the pro player; give an mp4/webm',
    });
    expect(
      buildVideoSection('en', { mode: 'background', url: 'https://youtu.be/dQw4w9WgXcQ' }),
    ).toEqual({ error: expect.stringMatching(/mp4/u) as unknown });
    expect(buildVideoPlayer('en', { src: 'javascript:alert(1)', type: 'video/mp4' })).toEqual({
      error: expect.any(String) as unknown,
    });
    expect(
      buildVideoPlayer('en', { src: '/a.mp4', type: 'video/mp4', poster: 'javascript:x' }),
    ).toEqual({ error: expect.stringMatching(/poster/u) as unknown });
    expect(buildVideoFacade('en', { video: { kind: 'youtube', id: 'bad' } })).toEqual({
      error: expect.any(String) as unknown,
    });
  });
});
