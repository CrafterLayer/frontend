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

function arabicSite(): BuilderSiteKernel {
  return createSiteBuilder({
    site: siteFromDocument(marketingLanding('rtl')),
    extensions: playgroundExtensions('landing'),
    ports: { clock: fixedClock(), ids: seededIds('agent-languages') },
  });
}

/** A model that "translates" by setting the open page's title, and records what it was asked. */
function translatingProvider(siteKernel: BuilderSiteKernel) {
  const asked: string[] = [];
  const provider: AiPlanProvider = {
    propose(request) {
      asked.push(request);
      const rootId = siteKernel.page(siteKernel.currentPage()).getDocument().rootId;
      return Promise.resolve({
        rationale: 'Translate the page.',
        commands: [{ command: 'setProp', args: { id: rootId, key: 'title', value: 'Jasmine' } }],
      });
    },
  };
  return { provider, asked };
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
    const { provider, asked } = translatingProvider(siteKernel);
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
  });

  it('takes the ordinary path for one page translated in place', async () => {
    const siteKernel = arabicSite();
    const { provider, asked } = translatingProvider(siteKernel);
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
  });
});
