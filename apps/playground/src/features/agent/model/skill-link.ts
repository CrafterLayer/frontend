/**
 * Import a skill from a link (2026-10-12), as other agents take a SKILL.md from a repository:
 * the Import box holds either the Markdown itself or one https link to it. A GitHub page link
 * (`/blob/…`) is read from its raw file, and a folder link (`/tree/…`) from the SKILL.md inside
 * it. The fetched text goes back into the box for the person to read before Add skill, so a link
 * never adds a skill on its own.
 */

/** A fetched skill larger than this is not a skill (instructions are capped far below it). */
export const SKILL_LINK_MAX_BYTES = 64_000;
const TIMEOUT_MS = 10_000;

export type SkillLink =
  { readonly ok: true; readonly url: string } | { readonly ok: false; readonly reason: 'insecure' };

/** The box's text as a link to fetch, or undefined when it is Markdown (or anything else). */
export function skillLinkOf(text: string): SkillLink | undefined {
  const trimmed = text.trim();
  if (/\s/u.test(trimmed) || !/^https?:\/\//iu.test(trimmed)) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'insecure' };
  if (url.hostname === 'github.com') {
    const [owner, repo, kind, ...rest] = url.pathname.split('/').filter((part) => part !== '');
    if (
      owner !== undefined &&
      repo !== undefined &&
      (kind === 'blob' || kind === 'tree') &&
      rest.length > 0
    ) {
      const path = kind === 'tree' ? [...rest, 'SKILL.md'] : rest;
      return {
        ok: true,
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${path.join('/')}`,
      };
    }
  }
  return { ok: true, url: url.href };
}

export type SkillFetch =
  | { readonly ok: true; readonly markdown: string; readonly host: string }
  | {
      readonly ok: false;
      readonly reason: 'network' | 'status' | 'page' | 'size' | 'empty';
      readonly status?: number | undefined;
    };

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** The text at a skill link: plain text or Markdown, never a web page, at most 64 KB. */
export async function fetchSkillMarkdown(
  url: string,
  fetcher: Fetcher = (target, init) => fetch(target, init),
): Promise<SkillFetch> {
  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!response.ok) return { ok: false, reason: 'status', status: response.status };
  const type = response.headers.get('content-type') ?? '';
  if (/html/iu.test(type)) return { ok: false, reason: 'page' };
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > SKILL_LINK_MAX_BYTES) return { ok: false, reason: 'size' };
  const markdown = await response.text();
  if (new TextEncoder().encode(markdown).length > SKILL_LINK_MAX_BYTES)
    return { ok: false, reason: 'size' };
  if (markdown.trim() === '') return { ok: false, reason: 'empty' };
  if (/^\s*<(?:!doctype|html)\b/iu.test(markdown)) return { ok: false, reason: 'page' };
  return { ok: true, markdown, host: new URL(response.url || url).hostname };
}
