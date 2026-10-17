import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createScriptedAiPlanProvider } from '@craftkit/builder/testing';
import type { AiPlanProvider, AiBuildOwnEvent } from '@craftkit/builder';

import { createAssistantKernel, renderPanel, requestPlan } from './AssistantPanel.test-helpers';
import {
  BUILD_DIRECTION,
  BUILD_REQUEST,
  THREE,
  createBuildKernel,
  historyLabels,
  regionList,
  regionsOf,
  scriptBuild,
  send,
} from './AssistantPanel.split-build.test-helpers';
import {
  PLAN_REQUEST,
  PLAN_TITLES,
  START_OVER_REQUEST,
  createPlanKernel,
  planLabels,
  planningProvider,
} from './AssistantPanel.page-plan.test-helpers';

describe('AssistantPanel — a page-plan build', () => {
  it('asks with what each section is FOR, and offers no Undo for a section the skeleton wrote in full', async () => {
    /*
      Wave-2 verifier, pageplan-revert.mjs (2026-09-28): the skeleton writes
      the footer from the plan's facts and reports it applied with 0 attempts
      and nothing recorded from before. The card offered "Undo Footer", the
      revert refused it, and the card then said it "never landed" — while it
      sat on the page.
    */
    const kernel = createPlanKernel();
    const { user } = renderPanel({ kernel, planProvider: planningProvider(), locale: 'en' });

    await send(user, PLAN_REQUEST);

    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText('Address and hours.')).toBeVisible();
    expect(within(approval).getByText('One clear way to order.')).toBeVisible();
    expect(kernel.transactions()).toHaveLength(0);
    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/5\/5 built in/)).toBeInTheDocument();
      },
      { timeout: 30_000 },
    );
    expect(planLabels(kernel)).toEqual(PLAN_TITLES);
    expect(screen.queryByRole('button', { name: 'Undo Footer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo Our coffees' })).toBeEnabled();

    // The build ends with its own SEO/menu pass, which rewrites the regions it fixes…
    expect(historyLabels(kernel).at(-1)).toBe('Assistant: SEO');

    // …and a section a writer filled still goes back on its own, forward, after it.
    await user.click(screen.getByRole('button', { name: 'Undo Our coffees' }));
    expect(historyLabels(kernel).at(-1)).toBe('Assistant: revert 3/5 — Our coffees');
    expect(screen.queryByText(/never landed/)).toBeNull();
  }, 60_000);
});

/**
 * ROUTING (2026-09-28). The panel asks the intent router what a request is FOR,
 * with the page it will run on — not whether a keyword appeared (agent-audit
 * P0-1 / P1-5) — and takes the path it can honour, saying so when that is not
 * the one the words asked for.
 */
describe('AssistantPanel — routing', () => {
  it('answers a question in words: nothing to apply, nothing written, no build', async () => {
    const kernel = createBuildKernel();
    let calls = 0;
    const provider: AiPlanProvider = {
      propose: () => {
        calls += 1;
        return Promise.resolve({ rationale: 'Open Theme and pick a display face.', commands: [] });
      },
    };
    const events: AiBuildOwnEvent[] = [];
    const { user } = renderPanel({
      kernel,
      planProvider: provider,
      onBuildEvent: (event) => events.push(event),
    });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, 'how do I change the font on this page?');

    expect(
      await screen.findByText('Open Theme and pick a display face.', {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(calls).toBe(1);
    expect(events).toEqual([]);
    expect(kernel.transactions()).toHaveLength(0);
    // An answer, not a plan: there is nothing behind it to apply or to build.
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Build this' })).toBeNull();
  }, 30_000);

  /*
    Wave-2 verifier, route-probe.mjs (2026-09-28): the router reads "how about
    …", "why not …" and "ليش ما …" as interrogatives at 0.9, and the panel sent
    them to a words-only answer with no Apply — where, before the router, the
    one run made the edit. What follows the opener is what is being asked for.
  */
  it('makes the edit a SUGGESTION asks for, rather than answering it in words', async () => {
    const kernel = createAssistantKernel();
    const { user } = renderPanel({
      kernel,
      planProvider: createScriptedAiPlanProvider({
        rationale: 'A warmer heading.',
        commands: [
          {
            command: 'setProp',
            args: { id: 'selected-hero', key: 'heading', value: 'Welcome home' },
          },
        ],
      }),
    });

    // `requestPlan` waits for the plan card's Apply — an outline has none.
    await requestPlan(user, 'what if the hero said Welcome home?');

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Welcome home');
  }, 30_000);

  it('sends a question the small catalog a remote run carries, not the whole one', async () => {
    /*
      An answer goes through `outlineAiPlan`, which defaulted to the FULL
      catalog when handed no policy — measured ~49k tokens for one Plan request
      against ~5k with `catalogMode: 'none'` (agent-audit P1-7d).
    */
    const kernel = createBuildKernel();
    const seen: string[][] = [];
    const provider: AiPlanProvider = {
      propose: (_request, context) => {
        seen.push(context.blocks.map((block) => block.type));
        return Promise.resolve({ rationale: 'Use the Theme panel.', commands: [] });
      },
    };
    const { user } = renderPanel({ kernel, planProvider: provider, providerKind: 'remote' });

    await send(user, 'how do I change the font on this page?');

    await screen.findByText('Use the Theme panel.', {}, { timeout: 15_000 });
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain('region');
  }, 30_000);

  it('keeps a page-like phrase an EDIT when a block is selected — the page is read, not just the words', async () => {
    const kernel = createAssistantKernel();
    kernel.setSelection(['selected-hero']);
    const events: AiBuildOwnEvent[] = [];
    const { user } = renderPanel({
      kernel,
      planProvider: createScriptedAiPlanProvider({
        rationale: 'Retitle the selected hero.',
        commands: [
          { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Clinic' } },
        ],
      }),
      onBuildEvent: (event) => events.push(event),
    });

    await requestPlan(user, 'a clinic page');

    expect(events).toEqual([]);
  }, 30_000);

  it('builds a site ask as ONE page, and says so on the card', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, 'build a 3-page website for my bakery: home, menu and contact');

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(screen.getByText(/the chat builds one page at a time/)).toBeVisible();
  }, 40_000);

  it('asks before starting a page WITH CONTENT over — even in Auto — and a refusal removes nothing', async () => {
    /*
      On 'replace' the engine's PagePlan path removes the page's children in the
      skeleton's own transaction (2026-09-28). Auto never asks — except here: a
      misread "start over" must not take a person's page without a question.
      REWRITTEN 2026-09-28 onto a provider that CAN plan a page: only that path
      removes anything, and a scaffold-only provider no longer asks (below).
    */
    const kernel = createPlanKernel(['Existing']);
    const before = kernel.transactions().length;
    const { user } = renderPanel({ kernel, planProvider: planningProvider(), locale: 'en' });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, START_OVER_REQUEST);

    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(/asks to start it over/)).toBeVisible();
    await user.click(within(approval).getByRole('button', { name: 'Stop build' }));

    await waitFor(
      () => {
        expect(screen.getByText('Stopped.')).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(planLabels(kernel)).toEqual(['Existing']);
    expect(kernel.transactions()).toHaveLength(before);
  }, 40_000);

  it('starts the page over when the person says Build — and the card said exactly that', async () => {
    const kernel = createPlanKernel(['Existing']);
    const { user } = renderPanel({ kernel, planProvider: planningProvider(), locale: 'en' });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, START_OVER_REQUEST);
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/5\/5 built in/)).toBeInTheDocument();
      },
      { timeout: 30_000 },
    );
    expect(planLabels(kernel)).toEqual(PLAN_TITLES);
    expect(screen.getByText(/asks to start it over/)).toBeVisible();
    expect(screen.queryByText(/nothing is replaced/)).toBeNull();
  }, 60_000);

  /*
    Wave-2 verifier, scaffold-replace.mjs (2026-09-28): the playground's real
    provider has no `proposePagePlan`, so its builds take the scaffold path,
    which APPENDS whatever the target — yet the card asked "start over?" and
    then promised "anything replaced comes back with one Undo". Nothing was.
  */
  it('never promises a start-over a scaffold build cannot do: the card says what the page will get', async () => {
    const kernel = createBuildKernel();
    kernel.dispatch('insertNode', {
      type: 'region',
      parentId: 'root',
      props: { label: 'Existing', tree: 'Written by hand.' },
    });
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });

    // Ask still asks — it always does — and the card is where the promise is made.
    await send(user, START_OVER_REQUEST);
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(/nothing is replaced/)).toBeVisible();
    expect(within(approval).queryByText(/start it over/)).toBeNull();
    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    // The notice matches the page: what was there is still there, above the build.
    expect(regionList(kernel).map(([label]) => label)).toEqual(['Existing', ...THREE]);
    expect(screen.getByText(/nothing is replaced/)).toBeVisible();
    expect(screen.queryByText(/comes back/)).toBeNull();
  }, 40_000);

  it('does not stop Auto to ask about a start-over that will not happen', async () => {
    const kernel = createBuildKernel();
    kernel.dispatch('insertNode', {
      type: 'region',
      parentId: 'root',
      props: { label: 'Existing', tree: 'Written by hand.' },
    });
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, START_OVER_REQUEST);

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionList(kernel).map(([label]) => label)).toEqual(['Existing', ...THREE]);
    expect(screen.getByText(/nothing is replaced/)).toBeVisible();
  }, 40_000);

  it('takes the start-over back when the page plan fails and the build falls back to appending', async () => {
    /*
      A provider that CAN plan a page may still fail to: the engine then lays a
      scaffold, which appends. The question is asked with no plan in hand, and
      that is when the card learns it — before the person decides.
    */
    const kernel = createPlanKernel(['Existing']);
    const { user } = renderPanel({
      kernel,
      planProvider: planningProvider({ planFails: true }),
      locale: 'en',
    });
    await user.click(screen.getByRole('radio', { name: 'Auto' }));

    await send(user, START_OVER_REQUEST);
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(/nothing is replaced/)).toBeVisible();
    expect(within(approval).queryByText(/start it over/)).toBeNull();
    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/built in/)).toBeInTheDocument();
      },
      { timeout: 30_000 },
    );
    expect(planLabels(kernel)[0]).toBe('Existing');
    expect(screen.getByText(/nothing is replaced/)).toBeVisible();
  }, 60_000);

  it('builds a NEW-page ask below the content, and says so BEFORE the person decides', async () => {
    const kernel = createBuildKernel();
    kernel.dispatch('insertNode', {
      type: 'region',
      parentId: 'root',
      props: { label: 'Existing', tree: 'Written by hand.' },
    });
    const script = scriptBuild(kernel, THREE);
    const { user } = renderPanel({ kernel, planProvider: script.provider, locale: 'en' });

    await send(user, BUILD_REQUEST);

    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 15_000 },
    );
    expect(within(approval).getByText(/built below what is already here/)).toBeVisible();
    await user.click(within(approval).getByRole('button', { name: 'Build' }));

    await waitFor(
      () => {
        expect(screen.getByText(/3\/3 built in/)).toBeInTheDocument();
      },
      { timeout: 20_000 },
    );
    expect(regionList(kernel)).toEqual([
      ['Existing', 'Written by hand.'],
      ['Hero', 'Body for Hero.'],
      ['Proof', 'Body for Proof.'],
      ['Pricing', 'Body for Pricing.'],
    ]);
    expect(screen.getByText(/built below what is already here/)).toBeVisible();
  }, 40_000);
});

/**
 * PLAN MODE MEETS THE SPLIT BUILD.
 *
 * A page-sized request used to be excluded from the build path in Plan mode
 * entirely, so the one request the build exists for was the one Plan could say
 * least about. Now it enters the path and stops at the skeleton: the page's
 * shape, and nothing written.
 */
describe('a page-sized request in Plan mode', () => {
  const TITLES = ['Hero', 'Work', 'Contact'];

  async function planAPage() {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, TITLES);
    const before = structuredClone(kernel.getDocument());
    const { user } = renderPanel({ kernel, planProvider: script.provider, providerKind: 'remote' });
    await user.click(screen.getByRole('radio', { name: 'Plan' }));
    await send(user, BUILD_REQUEST);
    await waitFor(() => {
      expect(screen.getByText(BUILD_DIRECTION)).toBeInTheDocument();
    });
    return { kernel, script, user, before };
  }

  it('writes NOTHING — not the skeleton, not a section', async () => {
    const { kernel, before } = await planAPage();
    expect(kernel.getDocument()).toEqual(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('shows the page it would lay out, in order', async () => {
    await planAPage();
    const log = within(screen.getByRole('log', { name: 'Conversation' }));
    expect(log.getAllByRole('listitem').map((item) => item.textContent)).toEqual(TITLES);
  });

  it('asks the model once — the sections are named, not written', async () => {
    const { script } = await planAPage();
    expect(script.calls()).toBe(1);
  });

  it('offers no Apply and no Undo: there is nothing to apply or take back', async () => {
    await planAPage();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('never asks the build approval question — nothing was going to be written', async () => {
    await planAPage();
    expect(screen.queryByRole('group', { name: 'Build this page' })).toBeNull();
  });

  it('builds it for real on request, moving the mode control with it', async () => {
    const { kernel, user } = await planAPage();
    await user.click(screen.getByRole('button', { name: 'Build this' }));
    /*
      The control moves FIRST, and visibly. A run's authority is fixed when it
      starts, so the panel must never sit in Plan while the run it just started
      writes — that is the exact lie the mode lock was introduced to end.
    */
    expect(screen.getByRole('radio', { name: 'Ask' })).toBeChecked();
    /*
      And it lands in ASK, not Auto: the person asked to plan, so the section
      list still gets its one approval before anything is filled.
    */
    const approval = await screen.findByRole(
      'group',
      { name: 'Build this page' },
      { timeout: 20_000 },
    );
    await user.click(within(approval).getByRole('button', { name: 'Build' }));
    await waitFor(
      () => {
        expect(Object.keys(regionsOf(kernel))).toEqual(TITLES);
      },
      { timeout: 20_000 },
    );
  }, 40_000);
});
