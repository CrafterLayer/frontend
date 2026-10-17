import { describe, expect, it } from 'vitest';

import { fetchSkillMarkdown, SKILL_LINK_MAX_BYTES, skillLinkOf, type Fetcher } from './skill-link';

const SKILL =
  '---\nname: Brand voice\ndescription: Every line of copy\n---\nWrite short, warm sentences.';

function answer(body: string, init: ResponseInit = {}, url = ''): Fetcher {
  return () => {
    const response = new Response(body, init);
    if (url !== '') Object.defineProperty(response, 'url', { value: url });
    return Promise.resolve(response);
  };
}

describe('skillLinkOf', () => {
  it.each([
    [
      'https://github.com/acme/skills/blob/main/brand-voice/SKILL.md',
      'https://raw.githubusercontent.com/acme/skills/main/brand-voice/SKILL.md',
    ],
    [
      'https://github.com/acme/skills/tree/main/brand-voice',
      'https://raw.githubusercontent.com/acme/skills/main/brand-voice/SKILL.md',
    ],
    [
      '  https://raw.githubusercontent.com/acme/skills/main/SKILL.md  ',
      'https://raw.githubusercontent.com/acme/skills/main/SKILL.md',
    ],
    ['https://example.com/skills/seo.mdx', 'https://example.com/skills/seo.mdx'],
    ['https://github.com/acme/skills', 'https://github.com/acme/skills'],
  ])('reads %s as %s', (text, url) => {
    expect(skillLinkOf(text)).toEqual({ ok: true, url });
  });

  it('refuses a plain http link', () => {
    expect(skillLinkOf('http://example.com/SKILL.md')).toEqual({ ok: false, reason: 'insecure' });
  });

  it.each(['', SKILL, 'see https://example.com/SKILL.md', 'example.com/SKILL.md', 'https://'])(
    'leaves %j as Markdown',
    (text) => {
      expect(skillLinkOf(text)).toBeUndefined();
    },
  );
});

describe('fetchSkillMarkdown', () => {
  it('returns the text and the host it came from, without cookies', async () => {
    const calls: RequestInit[] = [];
    const fetcher: Fetcher = (url, init) => {
      calls.push(init);
      return answer(
        SKILL,
        { headers: { 'content-type': 'text/plain; charset=utf-8' } },
        url,
      )(url, init);
    };
    expect(
      await fetchSkillMarkdown('https://raw.githubusercontent.com/a/b/main/SKILL.md', fetcher),
    ).toEqual({
      ok: true,
      markdown: SKILL,
      host: 'raw.githubusercontent.com',
    });
    expect(calls[0]).toMatchObject({ credentials: 'omit', redirect: 'follow' });
  });

  it('says why a link gave no skill', async () => {
    const url = 'https://example.com/SKILL.md';
    expect(await fetchSkillMarkdown(url, () => Promise.reject(new TypeError('offline')))).toEqual({
      ok: false,
      reason: 'network',
    });
    expect(await fetchSkillMarkdown(url, answer('nope', { status: 404 }))).toEqual({
      ok: false,
      reason: 'status',
      status: 404,
    });
    expect(
      await fetchSkillMarkdown(
        url,
        answer('<p>hi</p>', { headers: { 'content-type': 'text/html' } }),
      ),
    ).toEqual({ ok: false, reason: 'page' });
    expect(await fetchSkillMarkdown(url, answer('<!doctype html><html></html>'))).toEqual({
      ok: false,
      reason: 'page',
    });
    expect(await fetchSkillMarkdown(url, answer('x'.repeat(SKILL_LINK_MAX_BYTES + 1)))).toEqual({
      ok: false,
      reason: 'size',
    });
    expect(await fetchSkillMarkdown(url, answer('   \n'))).toEqual({ ok: false, reason: 'empty' });
  });
});
