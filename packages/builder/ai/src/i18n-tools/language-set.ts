import type { BuilderKernel } from '@craftkit/builder-core';
import { languageSetDirection } from '@craftkit/builder-schema';

import { isRecord, setProp } from '../tools/agent/shared';
import type { AgentToolContext, AgentToolStep } from '../tools/agent/types';
import { languageSwitcherSteps, relinkSteps } from './language-pages';

/**
 * One page of a language set, as a host writes it (2026-10-12): its alternates (every version,
 * itself included, so search engines see them reciprocal), its internal links pointed at the
 * pages of its own language, and the language switcher. Pure over the page's kernel; the host
 * dispatches the steps in one site transaction.
 */

export interface LanguageSetMember {
  readonly lang: string;
  readonly address: string;
}

export interface LanguageSetPage {
  /** Every page of the set, the source first (at most 8: the alternates limit). */
  readonly members: readonly LanguageSetMember[];
  /** This page's language in the set. */
  readonly lang: string;
  /** For a version: each source page's address → its version in this language. */
  readonly addresses?: ReadonlyMap<string, string>;
}

const MAX_ALTERNATES = 8;

function slot(id: string, key: string): string {
  return `${id}\u0000${key}`;
}

/** A tool context over a live page, reading the setProps of `steps` first (the last one wins). */
export function pageContext(
  kernel: BuilderKernel,
  steps: readonly AgentToolStep[] = [],
): AgentToolContext {
  const written = new Map<string, unknown>();
  for (const { command, args } of steps) {
    if (command === 'setProp' && typeof args['id'] === 'string' && typeof args['key'] === 'string')
      written.set(slot(args['id'], args['key']), args['value']);
  }
  const readProp = (id: string, key: string): unknown =>
    written.has(slot(id, key))
      ? written.get(slot(id, key))
      : kernel.getDocument().nodes[id]?.props[key];
  const document = kernel.getDocument();
  const lang = readProp(document.rootId, 'lang');
  const own = languageSetDirection({ lang, seo: readProp(document.rootId, 'seo') });
  return {
    kernel,
    readProp,
    locale: {
      lang: typeof lang === 'string' && lang !== '' ? lang : document.dir === 'rtl' ? 'ar' : 'en',
      dir: own ?? document.dir,
    },
    sampleValues: [],
  };
}

/** setProps merged by the prop they write: the last value wins, at its first position. */
function merged(steps: readonly AgentToolStep[]): readonly AgentToolStep[] {
  const out = new Map<string, AgentToolStep>();
  steps.forEach((step, at) => {
    const { id, key } = step.args;
    const key2 =
      step.command === 'setProp' && typeof id === 'string' && typeof key === 'string'
        ? slot(id, key)
        : `#${String(at)}`;
    const first = out.get(key2);
    out.set(key2, first === undefined ? step : { ...first, args: step.args });
  });
  return [...out.values()];
}

/** The steps one page of a language set needs. */
export function languageSetSteps(
  kernel: BuilderKernel,
  page: LanguageSetPage,
): readonly AgentToolStep[] {
  const rootId = kernel.getDocument().rootId;
  const members = page.members.slice(0, MAX_ALTERNATES);
  const stored = kernel.getDocument().nodes[rootId]?.props['seo'];
  const seo: Record<string, unknown> = isRecord(stored) ? { ...stored } : {};
  if (members[0]?.lang !== page.lang) {
    // A version is its own canonical page and never carries the home's site settings.
    delete seo['canonicalPath'];
    delete seo['site'];
  }
  seo['alternates'] = members.map(({ lang, address }) => ({ lang, path: address }));
  const steps: AgentToolStep[] = [setProp(rootId, 'seo', seo)];
  if (page.addresses !== undefined && page.addresses.size > 0)
    steps.push(...relinkSteps(pageContext(kernel, steps), page.addresses));
  const links = members.map(({ lang, address }) => ({ lang, href: address }));
  steps.push(...languageSwitcherSteps(pageContext(kernel, steps), links, page.lang));
  return merged(steps);
}
