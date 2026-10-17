import {
  codeViewExtension,
  createBuilder,
  type BuilderDocument,
  type BuilderKernel,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it, vi } from 'vitest';

import { commitDraft } from './commit-draft';
import { fingerprintDocument } from './drafts';

const kernelWith = (
  document: BuilderDocument,
  seed: string,
  withProjection = true,
): BuilderKernel =>
  createBuilder({
    document,
    extensions: withProjection ? [fixtureBlocks, codeViewExtension] : [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

const LABEL = 'AI: a studio page (3 sections)';

/** A draft built by editing a copy of the live document, the way a run does. */
function draftOf(live: BuilderKernel, edit: (draft: BuilderKernel) => void): BuilderDocument {
  const draft = kernelWith(live.getDocument(), 'draft');
  edit(draft);
  return draft.getDocument();
}

function setup(withProjection = true) {
  const live = kernelWith(landingFixture(), 'live', withProjection);
  return { live, baseFingerprint: fingerprintDocument(live.getDocument()) };
}

describe('commitDraft', () => {
  it('lands the whole draft as ONE transaction, whatever the run did', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Written by the agent' });
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    });

    const outcome = commitDraft({ live, draft, baseFingerprint, label: LABEL });

    expect(outcome.ok).toBe(true);
    expect(live.transactions()).toHaveLength(1);
    expect(live.getDocument()).toEqual(draft);
    expect(live.validate()).toEqual([]);
  });

  it('files it under the AI, with the label a person reads in history', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'x' });
    });

    commitDraft({ live, draft, baseFingerprint, label: LABEL });

    const tx = live.transactions()[0];
    expect(tx?.author).toBe('ai');
    expect(tx?.command).toBe(LABEL);
  });

  it('is reversed by exactly one undo — the whole generation, in one step', () => {
    const { live, baseFingerprint } = setup();
    const before = JSON.stringify(live.getDocument());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    });

    commitDraft({ live, draft, baseFingerprint, label: LABEL });
    expect(live.undo()).toBe(true);
    expect(JSON.stringify(live.getDocument())).toBe(before);
  });

  describe('refusing', () => {
    it('refuses a STALE commit with zero writes when the page moved underneath', () => {
      const { live, baseFingerprint } = setup();
      const draft = draftOf(live, (kernel) => {
        kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'From the run' });
      });

      // The person edits their page while the run is still building.
      live.dispatch('setProp', { id: 'p1', key: 'content', value: 'From the person' });
      const after = JSON.stringify(live.getDocument());
      const transactions = live.transactions().length;

      const outcome = commitDraft({ live, draft, baseFingerprint, label: LABEL });

      expect(outcome).toMatchObject({ ok: false, refusal: 'stale' });
      expect(JSON.stringify(live.getDocument())).toBe(after);
      expect(live.transactions()).toHaveLength(transactions);
    });

    it('checks staleness BEFORE it computes anything', () => {
      const { live, baseFingerprint } = setup();
      live.dispatch('setProp', { id: 'p1', key: 'content', value: 'moved' });
      const projection = vi.spyOn(live.context.registry, 'projection');

      commitDraft({ live, draft: live.getDocument(), baseFingerprint, label: LABEL });

      // Not "no write" — no WORK. Zero writes is easy to lose by leaving late.
      expect(projection).not.toHaveBeenCalled();
    });

    it('refuses an UNCHANGED draft rather than recording an empty entry', () => {
      const { live, baseFingerprint } = setup();
      const outcome = commitDraft({
        live,
        draft: live.getDocument(),
        baseFingerprint,
        label: LABEL,
      });

      expect(outcome).toMatchObject({ ok: false, refusal: 'unchanged' });
      expect(live.transactions()).toHaveLength(0);
    });

    it('refuses when the host cannot land a whole document at all', () => {
      const { live, baseFingerprint } = setup(false);
      const draft = draftOf(live, (kernel) => {
        kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'x' });
      });

      expect(commitDraft({ live, draft, baseFingerprint, label: LABEL })).toMatchObject({
        ok: false,
        refusal: 'unavailable',
      });
      expect(live.transactions()).toHaveLength(0);
    });

    it('refuses a draft that does not validate against this page', () => {
      const { live, baseFingerprint } = setup();
      const draft = draftOf(live, (kernel) => {
        kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'x' });
      });
      const broken: BuilderDocument = {
        ...draft,
        nodes: { ...draft.nodes, ghost: { id: 'ghost', type: 'no-such-block', props: {} } },
      };

      expect(commitDraft({ live, draft: broken, baseFingerprint, label: LABEL })).toMatchObject({
        ok: false,
        refusal: 'invalid',
      });
      expect(live.transactions()).toHaveLength(0);
    });

    it('says something a person can act on, never a code', () => {
      const { live, baseFingerprint } = setup();
      live.dispatch('setProp', { id: 'p1', key: 'content', value: 'moved' });
      const outcome = commitDraft({
        live,
        draft: live.getDocument(),
        baseFingerprint,
        label: LABEL,
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toMatch(/nothing was applied/u);
      }
    });
  });

  it('reports how much it landed', () => {
    const { live, baseFingerprint } = setup();
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'x' });
    });

    const outcome = commitDraft({ live, draft, baseFingerprint, label: LABEL });
    expect(outcome.ok && outcome.patches).toBeGreaterThan(0);
  });
});
