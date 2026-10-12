/**
 * What the app hands the agent panel (agent-host.ts): which panel mounts, its language,
 * the fast model and effort an edit runs on, and how a "new page" request opens its page.
 */
import { createSiteBuilder } from '@craftkit/builder';
import { fivePageSite, fixedClock, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

import {
  agentLocaleFromEnv,
  agentPanelFromEnv,
  editEffortFromEnv,
  editModelFromEnv,
  fastestModel,
  nextPageAddress,
  pageOpener,
  planModelChoice,
} from './agent-host';

describe('agentPanelFromEnv', () => {
  it.each([
    [{}, 'v2'],
    [{ VITE_AGENT_PANEL: 'v2' }, 'v2'],
    [{ VITE_AGENT_PANEL: ' V1 ' }, 'v1'],
    [{ VITE_AGENT_PANEL: 'v1' }, 'v1'],
    [{ VITE_AGENT_PANEL: 'legacy' }, 'v2'],
    [{ VITE_AGENT_PANEL: 1 }, 'v2'],
  ])('%j mounts %s', (env, panel) => {
    expect(agentPanelFromEnv(env)).toBe(panel);
  });
});

describe('agentLocaleFromEnv', () => {
  it('pins a language only when the build names one; else the editor decides', () => {
    expect(agentLocaleFromEnv({})).toBeUndefined();
    expect(agentLocaleFromEnv({ VITE_AGENT_LOCALE: 'en' })).toBe('en');
    expect(agentLocaleFromEnv({ VITE_AGENT_LOCALE: ' AR ' })).toBe('ar');
    expect(agentLocaleFromEnv({ VITE_AGENT_LOCALE: 'fr' })).toBeUndefined();
  });
});

describe('fastestModel (the server’s ranking, restated)', () => {
  it.each([
    [['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'], 'anthropic/claude-haiku-4.5'],
    [['google/gemini-3-pro', 'google/gemini-3-flash'], 'google/gemini-3-flash'],
    // A tier word counts only as a whole word: "gemini" is not "mini", "minimax" is not.
    [['minimax/minimax-m3', 'openai/gpt-5.6-terra'], 'openai/gpt-5.6-terra'],
    // A free slug's time is its queue's: last in its tier.
    [['vendor/lite:free', 'vendor/nano'], 'vendor/nano'],
    // Ties keep the order given.
    [['a/opus', 'b/sol'], 'a/opus'],
    [[], undefined],
    [['  '], undefined],
  ])('%j → %s', (models, fastest) => {
    expect(fastestModel(models)).toBe(fastest);
  });
});

describe('editModelFromEnv / editEffortFromEnv', () => {
  const offered = ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'];

  it('takes the owner’s edit model, else the fastest offered, else the server’s default', () => {
    expect(editModelFromEnv({ VITE_AI_EDIT_MODEL: 'vendor/x' }, offered)).toBe('vendor/x');
    expect(editModelFromEnv({ VITE_AI_EDIT_MODEL: '' }, offered)).toBe('anthropic/claude-haiku-4.5');
    expect(editModelFromEnv({}, [])).toBeUndefined();
  });

  it('runs edits at low effort unless medium is asked for', () => {
    expect(editEffortFromEnv({})).toBe('low');
    expect(editEffortFromEnv({ VITE_AI_EDIT_EFFORT: 'medium' })).toBe('medium');
    expect(editEffortFromEnv({ VITE_AI_EDIT_EFFORT: 'high' })).toBe('low');
  });
});

describe('planModelChoice (the picker’s model before and after a pick)', () => {
  // The order VITE_AI_PLAN_MODELS lists them in, «دقيق»/Careful first: the order must not decide.
  const offered = ['anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5'];

  it('starts on the fastest offered model, not the first listed', () => {
    expect(planModelChoice(null, offered)).toBe('anthropic/claude-haiku-4.5');
  });

  it('keeps a remembered pick while it is still on offer', () => {
    expect(planModelChoice('anthropic/claude-sonnet-5', offered)).toBe('anthropic/claude-sonnet-5');
  });

  it('drops a remembered pick the server no longer offers', () => {
    expect(planModelChoice('vendor/retired', offered)).toBe('anthropic/claude-haiku-4.5');
  });

  it('names no model when none is offered, so the server’s default answers', () => {
    expect(planModelChoice(null, [])).toBeUndefined();
    expect(planModelChoice('vendor/retired', [])).toBeUndefined();
  });
});

describe('pageOpener', () => {
  function site() {
    return createSiteBuilder({
      site: fivePageSite(),
      ports: { clock: fixedClock(), ids: seededIds('agent-host') },
    });
  }

  it('opens a page titled from the request, makes it current, and hands back its lens', async () => {
    const siteKernel = site();
    const before = siteKernel.getSite().pages.length;
    const { kernel } = await pageOpener(siteKernel)('Our menu');

    const pages = siteKernel.getSite().pages;
    expect(pages).toHaveLength(before + 1);
    const created = pages.at(-1);
    expect(created?.title).toBe('Our menu');
    expect(siteKernel.currentPage()).toBe(created?.id);
    expect(kernel).toBe(siteKernel.page(created?.id ?? ''));
    // Authored by the assistant, so the change strip says who opened it.
    expect(siteKernel.transactions().at(-1)?.author).toBe('ai');
  });

  it('picks the first free /page-N address', () => {
    expect(nextPageAddress(['/', '/about'])).toBe('/page-3');
    expect(nextPageAddress(['/', '/page-2'])).toBe('/page-3');
    expect(nextPageAddress(['/', '/page-3', '/page-4'])).toBe('/page-5');
  });
});
