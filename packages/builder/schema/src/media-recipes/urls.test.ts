import { describe, expect, it } from 'vitest';

import { isAllowedIframeSrc } from '../custom-code/custom-code-tree';
import {
  classifyVideoUrl,
  mapsEmbedUrl,
  mapsLinkUrl,
  VIDEO_HLS_REFUSAL,
  videoEmbedUrl,
  youtubeThumb,
} from './urls';

describe('classifyVideoUrl', () => {
  it('reads every YouTube form as one id', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=30',
      'http://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      '  https://youtu.be/dQw4w9WgXcQ  ',
    ]) {
      expect(classifyVideoUrl(url), url).toEqual({ kind: 'youtube', id: 'dQw4w9WgXcQ' });
    }
  });

  it('reads Vimeo pages and players', () => {
    expect(classifyVideoUrl('https://vimeo.com/76979871')).toEqual({ kind: 'vimeo', id: '76979871' });
    expect(classifyVideoUrl('https://vimeo.com/channels/staffpicks/76979871')).toEqual({
      kind: 'vimeo',
      id: '76979871',
    });
    expect(classifyVideoUrl('https://player.vimeo.com/video/76979871')).toEqual({
      kind: 'vimeo',
      id: '76979871',
    });
  });

  it('reads https and uploaded mp4/webm files', () => {
    expect(classifyVideoUrl('https://cdn.example.com/clip.mp4')).toEqual({
      kind: 'file',
      src: 'https://cdn.example.com/clip.mp4',
      type: 'video/mp4',
    });
    expect(classifyVideoUrl('https://cdn.example.com/clip.WEBM?v=2')).toEqual({
      kind: 'file',
      src: 'https://cdn.example.com/clip.WEBM?v=2',
      type: 'video/webm',
    });
    expect(classifyVideoUrl('/uploads/hero.mp4')).toEqual({
      kind: 'file',
      src: '/uploads/hero.mp4',
      type: 'video/mp4',
    });
  });

  it('refuses HLS with its own repair text, and everything else with the allowed forms', () => {
    expect(classifyVideoUrl('https://cdn.example.com/live.m3u8')).toEqual({ error: VIDEO_HLS_REFUSAL });
    for (const url of [
      '',
      'not a url',
      'http://cdn.example.com/clip.mp4',
      'https://cdn.example.com/clip.mov',
      '//cdn.example.com/clip.mp4',
      'javascript:alert(1)',
      'https://youtu.be/short',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
      'https://example.com/watch?v=dQw4w9WgXcQ',
    ]) {
      const result = classifyVideoUrl(url);
      expect('error' in result, url).toBe(true);
    }
    const plain = classifyVideoUrl('https://cdn.example.com/clip.mov');
    expect('error' in plain ? plain.error : '').toMatch(/youtu\.be.*vimeo\.com.*\.mp4/u);
  });
});

describe('embed and map addresses', () => {
  it('builds embeds the iframe allowlist admits', () => {
    expect(isAllowedIframeSrc(videoEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ' }))).toBe(true);
    expect(isAllowedIframeSrc(videoEmbedUrl({ kind: 'vimeo', id: '76979871' }))).toBe(true);
    expect(youtubeThumb('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('encodes any address, Arabic and quotes included, into the keyless embed', () => {
    for (const address of [
      'Amman Citadel',
      'جبل القلعة، عمّان',
      "O'Reilly's Pub & Grill, 5th Ave",
      'a"b<c>d',
    ]) {
      const embed = mapsEmbedUrl(address) ?? '';
      expect(isAllowedIframeSrc(embed), embed).toBe(true);
      expect(mapsLinkUrl(address)).toBe(embed.replace(/&output=embed$/u, ''));
    }
    expect(mapsEmbedUrl('   ')).toBeUndefined();
    expect(mapsEmbedUrl('x'.repeat(301))).toBeUndefined();
  });
});
