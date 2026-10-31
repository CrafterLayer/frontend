/**
 * A site in several languages through the panel (2026-10-12), with the real engine, the real
 * site kernel and the playground's own landing: «Make the site in Arabic and English» on an
 * Arabic site adds `/en` (no model), says so in the thread, shows the version, and runs ONE
 * edit on that version alone, asked to translate it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  createSiteBuilder,
  siteFromDocument,
  type AiPlanProvider,
  type BuilderSiteKernel,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import { marketingLanding, playgroundExtensions } from '../../preview/create-playground-kernel';
import { createLanguageVersions } from '../model/language-versions';
import { memoryStorage } from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

const WAIT = { timeout: 20_000 } as const;

/** The page's own CSS: code a translation never reads, so its request must not carry it. */
const PAGE_CSS = ':root{--t-accent:#0f766e}\nbody{font-family:system-ui}';

function arabicSite(): BuilderSiteKernel {
  const siteKernel = createSiteBuilder({
    site: siteFromDocument(marketingLanding('rtl')),
    extensions: playgroundExtensions('landing'),
    ports: { clock: fixedClock(), ids: seededIds('agent-languages') },
  });
  siteKernel
    .page(siteKernel.currentPage())
    .dispatch('setProp', { id: 'root', key: 'pageCss', value: PAGE_CSS });
  return siteKernel;
}

type SeenContext = Parameters<AiPlanProvider['propose']>[1];

/**
 * Every code prop a run was shown. A translation sees each one's size, never its body
 * (`documentCode: 'omitted'`): a built page's code is most of its request, and a large one
 * was refused whole — «الصفحة كبيرة على الطلب» — after the site build that preceded it.
 */
function codeShown(context: SeenContext | undefined): readonly string[] {
  return (context?.document.nodes ?? []).flatMap((node) =>
    ['css', 'js', 'pageCss'].flatMap((key) => {
      const value = node.props[key];
      return typeof value === 'string' && value !== '' ? [value] : [];
    }),
  );
}

/** A model that "translates" by setting the open page's title, and records what it was asked. */
function translatingProvider(siteKernel: BuilderSiteKernel) {
  const asked: string[] = [];
  const seen: SeenContext[] = [];
  const provider: AiPlanProvider = {
    propose(request, context) {
      asked.push(request);
      seen.push(context);
      const rootId = siteKernel.page(siteKernel.currentPage()).getDocument().rootId;
      return Promise.resolve({
        rationale: 'Translate the page.',
        commands: [{ command: 'setProp', args: { id: rootId, key: 'title', value: 'Jasmine' } }],
      });
    },
  };
  return { provider, asked, seen };
}

function titleAt(siteKernel: BuilderSiteKernel, address: string): unknown {
  const page = siteKernel.getSite().pages.find((entry) => entry.address === address);
  return page?.document.nodes[page.document.rootId]?.props['title'];
}

describe('useAgentController · language versions', () => {
  it('adds the English version, says so, and translates only that page', async () => {
    const siteKernel = arabicSite();
    const home = siteKernel.currentPage();
    const before = titleAt(siteKernel, '/');
    const { provider, asked, seen } = translatingProvider(siteKernel);
    const options: UseAgentControllerOptions = {
      kernel: siteKernel.page(home),
      locale: 'en',
      storage: memoryStorage(),
      enhancer: null,
      provider,
      languageVersions: createLanguageVersions(siteKernel),
    };
    const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
      initialProps: options,
    });
    act(() => {
      hook.result.current.setDraft('Make the site in Arabic and English');
    });
    act(() => {
      hook.result.current.send();
    });

    await waitFor(() => {
      expect(hook.result.current.state.run).toBeNull();
      expect(asked).toHaveLength(1);
    }, WAIT);
    expect(asked[0]).toContain('Translate this page to English (/en).');
    const english = siteKernel.getSite().pages.find(({ address }) => address === '/en');
    expect(siteKernel.currentPage()).toBe(english?.id);
    expect(titleAt(siteKernel, '/en')).toBe('Jasmine');
    expect(titleAt(siteKernel, '/')).toBe(before);
    const kinds = hook.result.current.state.turns.map(({ kind }) => kind);
    expect(kinds).toEqual(['user', 'answer', 'user', 'edit']);
    // The version's translation read the page's words, never its code.
    expect(codeShown(seen[0])).toEqual([
      `[pageCss: ${String(PAGE_CSS.length)} characters, not shown]`,
    ]);
  });

  it('takes the ordinary path for one page translated in place', async () => {
    const siteKernel = arabicSite();
    const { provider, asked, seen } = translatingProvider(siteKernel);
    const hook = renderHook(() =>
      useAgentController({
        kernel: siteKernel.page(siteKernel.currentPage()),
        locale: 'en',
        storage: memoryStorage(),
        enhancer: null,
        provider,
        languageVersions: createLanguageVersions(siteKernel),
      }),
    );
    act(() => {
      hook.result.current.setDraft('Translate the page to English');
    });
    act(() => {
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(asked).toHaveLength(1);
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    expect(siteKernel.getSite().pages).toHaveLength(1);
    // The person's own "translate the page" is words only too.
    expect(codeShown(seen[0])).toEqual([
      `[pageCss: ${String(PAGE_CSS.length)} characters, not shown]`,
    ]);
  });

  it('still shows the code to an edit that is not a translation', async () => {
    const siteKernel = arabicSite();
    const { provider, asked, seen } = translatingProvider(siteKernel);
    const hook = renderHook(() =>
      useAgentController({
        kernel: siteKernel.page(siteKernel.currentPage()),
        locale: 'en',
        storage: memoryStorage(),
        enhancer: null,
        provider,
        languageVersions: createLanguageVersions(siteKernel),
      }),
    );
    act(() => {
      hook.result.current.setDraft('Make the page title warmer');
    });
    act(() => {
      hook.result.current.send();
    });
    await waitFor(() => {
      expect(asked).toHaveLength(1);
      expect(hook.result.current.state.run).toBeNull();
    }, WAIT);
    expect(codeShown(seen[0])).toEqual([PAGE_CSS]);
  });
});
