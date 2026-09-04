import {
  codeViewExtension,
  createBuilder,
  emptyDocument,
  type BuilderDocument,
  type BuilderKernel,
  type CoreCommands,
  type JsonValue,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder/testing';
import { describe, expect, it } from 'vitest';

/**
 * SPIKE S3 — the exit gate for the COMMIT door.
 *
 * QUESTION: can a draft land on the live document as ONE transaction that is
 * attributed to the AI, carries a readable label, is reversed by ONE undo, and
 * is refused with zero writes when the live document moved underneath it?
 *
 * WHY IT MATTERS: `restoreDocument` already lands a whole document as one
 * transaction, but it hardcodes `author: 'codeview'` (`restore.ts:68`), and the
 * spec requires the agent's changes to be attributed to the agent. If the only
 * proven route cannot carry an author, the plan's "one atomic commit, labelled
 * and attributed" is not buildable as written and D4 changes shape.
 *
 * The commit below is the spike's own function, deliberately NOT a change to
 * `restore.ts`: a spike answers a question, it does not edit shipped code.
 */

const kernelWith = (document: BuilderDocument, seed: string): BuilderKernel =>
  createBuilder({
    document,
    extensions: [fixtureBlocks, codeViewExtension],
    ports: { clock: fixedClock(), ids: seededIds(seed) },
  });

const CANONICAL_JSON_PROJECTION = 'canonical-json';

interface CommitOutcome {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * The candidate commit door: the same projection route `restoreDocument` takes,
 * with the author and the label the plan requires, plus a fingerprint the
 * caller captured when the draft was seeded.
 */
function commitDraftSpike(
  live: BuilderKernel,
  draft: BuilderDocument,
  options: { label: string; baseFingerprint: string },
): CommitOutcome {
  if (fingerprint(live.getDocument()) !== options.baseFingerprint) {
    // Refused BEFORE anything is computed, let alone written.
    return { ok: false, reason: 'The page changed while this run was building.' };
  }
  const projection = live.context.registry.projection(CANONICAL_JSON_PROJECTION);
  if (projection === undefined) {
    return { ok: false, reason: 'The canonical-json projection is not registered.' };
  }
  const parsed = projection.parse(projection.project(draft), live.getDocument(), {
    blockExists: (type) => live.context.registry.block(type) !== undefined,
  });
  if (!parsed.ok) {
    return { ok: false, reason: 'The draft could not be parsed against the live page.' };
  }
  if (parsed.patches.length === 0) {
    return { ok: false, reason: 'The draft is identical to the live page.' };
  }
  const patches: CoreCommands['applyPatches']['patches'] = parsed.patches.map((patch) => ({
    op: patch.op,
    path: [...patch.path],
    ...(patch.value === undefined ? {} : { value: patch.value as JsonValue }),
  }));
  live.dispatchGroup([{ command: 'applyPatches', args: { patches } }], {
    author: 'ai',
    label: options.label,
  });
  return { ok: true };
}

/** Stand-in for the real `sha256(canonicalJsonStringify(doc))`; identity is what is tested. */
function fingerprint(document: BuilderDocument): string {
  return JSON.stringify(document);
}

const LABEL = 'AI: site from brief "a studio page" (1 page)';

function draftOf(live: BuilderKernel, edit: (draft: BuilderKernel) => void): BuilderDocument {
  const draft = kernelWith(live.getDocument(), 'draft');
  edit(draft);
  return draft.getDocument();
}

describe('S3 — committing a draft to the live document', () => {
  it('lands as ONE transaction attributed to the AI, with the label', () => {
    const live = kernelWith(landingFixture(), 'live');
    const base = fingerprint(live.getDocument());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Written by the agent' });
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    });

    expect(commitDraftSpike(live, draft, { label: LABEL, baseFingerprint: base })).toEqual({
      ok: true,
    });

    // Two edits in the draft, ONE transaction on the live document.
    expect(live.transactions()).toHaveLength(1);
    const tx = live.transactions()[0];
    expect(tx?.author).toBe('ai');
    expect(tx?.command).toBe(LABEL);
    expect(live.getDocument()).toEqual(draft);
    expect(live.validate()).toEqual([]);
  });

  it('is reversed by exactly one undo', () => {
    const live = kernelWith(landingFixture(), 'live');
    const before = JSON.stringify(live.getDocument());
    const base = fingerprint(live.getDocument());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
    });

    commitDraftSpike(live, draft, { label: LABEL, baseFingerprint: base });
    expect(live.undo()).toBe(true);

    // The whole generation, gone in one step — SC-011 stated as an assertion.
    expect(JSON.stringify(live.getDocument())).toBe(before);
  });

  it('refuses a stale draft with ZERO writes when the live page moved', () => {
    const live = kernelWith(landingFixture(), 'live');
    const base = fingerprint(live.getDocument());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'From the run' });
    });

    // Somebody edits the page while the run is still building.
    live.dispatch('setProp', { id: 'p1', key: 'content', value: 'By hand' });
    const afterHandEdit = JSON.stringify(live.getDocument());
    const txCount = live.transactions().length;

    const outcome = commitDraftSpike(live, draft, { label: LABEL, baseFingerprint: base });

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain('changed while');
    // Counted, not asserted: a refusal writes nothing.
    expect(live.transactions()).toHaveLength(txCount);
    expect(JSON.stringify(live.getDocument())).toBe(afterHandEdit);
  });

  it('refuses an unchanged draft rather than recording an empty transaction', () => {
    const live = kernelWith(landingFixture(), 'live');
    const base = fingerprint(live.getDocument());

    const outcome = commitDraftSpike(live, live.getDocument(), {
      label: LABEL,
      baseFingerprint: base,
    });

    expect(outcome.ok).toBe(false);
    expect(live.transactions()).toHaveLength(0);
  });

  it('keeps the live document valid, or writes nothing at all', () => {
    const live = kernelWith(emptyDocument('site', 'ltr'), 'live');
    const base = fingerprint(live.getDocument());
    /*
      A draft whose vocabulary the live registry does not have. `applyPatches`
      revalidates the WHOLE document registry-aware, so this is the case where
      the door has to refuse rather than corrupt — and a throw must leave the
      log untouched.
    */
    const alien: BuilderDocument = {
      ...live.getDocument(),
      nodes: {
        ...live.getDocument().nodes,
        ghost: { id: 'ghost', type: 'not-registered-anywhere', props: {} },
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['ghost'] } },
      },
    };

    /*
      Either ending is acceptable — a refusal or a throw — because both mean the
      same thing to the document. What is NOT acceptable is a write.

      Written without a bare `catch`, deliberately. An earlier version wrapped
      the assertion in `try { expect(...) } catch {}`, which swallows the
      assertion's own failure: had the commit SUCCEEDED, the `expect` would have
      thrown, the empty catch would have eaten it, and the test would have
      passed while reporting the opposite of the truth. Capturing the outcome
      first and asserting afterwards keeps both endings observable.
    */
    let ok: boolean | undefined;
    let threw = false;
    try {
      ok = commitDraftSpike(live, alien, { label: LABEL, baseFingerprint: base }).ok;
    } catch {
      threw = true;
    }

    expect(threw || ok === false).toBe(true);
    expect(live.transactions()).toHaveLength(0);
    expect(live.validate()).toEqual([]);
    expect(live.getDocument()).toEqual(emptyDocument('site', 'ltr'));
  });
});

describe('S3 — what the spike does NOT yet prove', () => {
  it('commits a REMOVAL, not only additions and edits', () => {
    const live = kernelWith(landingFixture(), 'live');
    const base = fingerprint(live.getDocument());
    const draft = draftOf(live, (kernel) => {
      kernel.dispatch('removeNode', { id: 'p1' });
    });

    /*
      The projection route was proved for adds and edits only, and a deletion
      takes a different path through the diff — `remove` patches carry no value
      and array indices shift under them. A commit door that could not delete
      would fail the first time a run replaced a section rather than adding one.
    */
    expect(commitDraftSpike(live, draft, { label: LABEL, baseFingerprint: base }).ok).toBe(true);

    expect(live.getDocument().nodes['p1']).toBeUndefined();
    expect(live.transactions()).toHaveLength(1);
    expect(live.validate()).toEqual([]);
    expect(live.undo()).toBe(true);
    expect(live.getDocument().nodes['p1']).toBeDefined();
  });

  it('preserves the node ids the DRAFT minted, which is why patches beat a replay', () => {
    const live = kernelWith(landingFixture(), 'live');
    const base = fingerprint(live.getDocument());
    let mintedId: string | undefined;
    const draft = draftOf(live, (kernel) => {
      const before = new Set(Object.keys(kernel.getDocument().nodes));
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' });
      mintedId = Object.keys(kernel.getDocument().nodes).find((id) => !before.has(id));
    });

    /*
      The plan's reason for committing patches rather than replaying the run's
      steps: a replay would re-mint ids through the LIVE port, and every
      reference the run recorded would point at a node that no longer exists.
      This asserts the id survives the crossing.
    */
    expect(mintedId).toBeDefined();
    commitDraftSpike(live, draft, { label: LABEL, baseFingerprint: base });
    expect(live.getDocument().nodes[mintedId ?? '']).toBeDefined();
  });
});
