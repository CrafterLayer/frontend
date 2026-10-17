import { describe, expect, it } from 'vitest';

import { LATEST_SCHEMA_VERSION, type BuilderDocument } from '@craftkit/builder';

import { describeCost, describeImpact, planImpact } from './AssistantPanel.impact';

function doc(
  nodes: BuilderDocument['nodes'],
  meta: Partial<Pick<BuilderDocument, 'dir' | 'surface'>> = {},
): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
    ...meta,
  };
}

const page = (children: string[]) => ({
  root: { id: 'root', type: 'page', props: {}, slots: { default: children } },
});

describe('planImpact', () => {
  it('names what was added, in the order it reads down the page', () => {
    /*
      Document order, not `Object.keys` order. Keys come back in insertion
      order, which for an edited document is the order things were CREATED —
      a meaningless sequence to someone looking at a page top to bottom.
    */
    const before = doc({ ...page([]) });
    const after = doc({
      ...page(['hero', 'pricing']),
      hero: { id: 'hero', type: 'hero', props: {} },
      pricing: { id: 'pricing', type: 'pricing', props: {} },
    });

    const impact = planImpact(before, after);

    expect(impact.added).toEqual(['hero', 'pricing']);
    expect(impact.addedTypes).toEqual(['hero', 'pricing']);
    expect(impact.changed).toEqual([]);
    expect(impact.removed).toEqual([]);
    expect(impact.empty).toBe(false);
  });

  it('reports a changed node, and does NOT report an untouched one', () => {
    const before = doc({
      ...page(['a', 'b']),
      a: { id: 'a', type: 'text', props: { content: 'one' } },
      b: { id: 'b', type: 'text', props: { content: 'two' } },
    });
    const after = doc({
      ...page(['a', 'b']),
      a: { id: 'a', type: 'text', props: { content: 'ONE' } },
      b: { id: 'b', type: 'text', props: { content: 'two' } },
    });

    const impact = planImpact(before, after);

    expect(impact.changed).toEqual(['a']);
    expect(impact.added).toEqual([]);
  });

  it('reports a removal', () => {
    const before = doc({
      ...page(['a']),
      a: { id: 'a', type: 'text', props: {} },
    });
    const after = doc({ ...page([]) });

    const impact = planImpact(before, after);

    expect(impact.removed).toEqual(['a']);
    /*
      The root is NOT counted as changed. Its slot list lost a child, which is
      the mechanical consequence of the removal already reported — counting it
      would make "1 removed, 1 changed" out of what a person calls "1 removed".
    */
    expect(impact.changed).toEqual([]);
  });

  it('reports a REORDER, which nothing else in the summary would say', () => {
    /*
      The same children in a different order: no addition, no removal, and no
      prop touched. If a slot-order difference did not count, this plan would
      report "changes nothing" while visibly rearranging the page.
    */
    const before = doc({
      ...page(['a', 'b']),
      a: { id: 'a', type: 'text', props: {} },
      b: { id: 'b', type: 'text', props: {} },
    });
    const after = doc({
      ...page(['b', 'a']),
      a: { id: 'a', type: 'text', props: {} },
      b: { id: 'b', type: 'text', props: {} },
    });

    const impact = planImpact(before, after);

    expect(impact.changed).toEqual(['root']);
    expect(impact.empty).toBe(false);
  });

  it('reports a MOVE between parents — nothing was added or removed to explain it', () => {
    /*
      Found by an adversarial probe, not by me. A node moved from one box to
      another: neither parent's membership survives the "already accounted for"
      rule, and the node itself is byte-identical — so the summary said the plan
      changes NOTHING while the page visibly rearranged.

      The rule was written for add and remove, where a parent's slot change IS
      explained by a reported child. A move has no such child, and that is the
      case it missed.
    */
    const before = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
      boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: ['x'] } },
      boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: [] } },
      x: { id: 'x', type: 'text', props: { content: 'hi' } },
    });
    const after = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
      boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: [] } },
      boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: ['x'] } },
      x: { id: 'x', type: 'text', props: { content: 'hi' } },
    });

    const impact = planImpact(before, after);

    expect(impact.empty).toBe(false);
    expect(impact.changed).toEqual(['boxA', 'boxB']);
  });

  it('does not report a node as changed just because its props were built in another order', () => {
    /*
      `JSON.stringify` walks keys in insertion order, and a plan's commands
      routinely produce the same props in a different sequence. Comparing the
      raw string made that read as a change to a node nothing touched.
    */
    const before = doc({
      ...page(['a']),
      a: { id: 'a', type: 'text', props: { content: 'x', tone: 'quiet' } },
    });
    const after = doc({
      ...page(['a']),
      a: { id: 'a', type: 'text', props: { tone: 'quiet', content: 'x' } },
    });

    expect(planImpact(before, after).empty).toBe(true);
  });

  it('counts a deleted block ONCE, even when a slot still lists it', () => {
    /*
      A dangling reference — the id still in a parent's slot, the node gone from
      `nodes` — was reported both as removed and as changed, so deleting one
      block read as two facts about it.
    */
    const before = doc({
      ...page(['a']),
      a: { id: 'a', type: 'text', props: {} },
    });
    // The slot still names `a`, but the node is gone.
    const after = doc({ ...page(['a']) });

    const impact = planImpact(before, after);

    expect(impact.removed).toEqual(['a']);
    expect(impact.changed).not.toContain('a');
  });

  it('reports a DIRECTION flip, which no node diff would ever mention', () => {
    /*
      `setDocMeta` is an ordinary command and `dir` is not a node, so a node
      diff cannot see it. Flipping a page to RTL rearranges everything a person
      can see — and the card used to say "changes nothing" about the largest
      change the panel can make.
    */
    const nodes = { ...page(['a']), a: { id: 'a', type: 'text', props: {} } };
    const impact = planImpact(doc(nodes), doc(structuredClone(nodes), { dir: 'rtl' }));

    expect(impact.empty).toBe(false);
    expect(impact.meta).toEqual(['dir']);
    expect(describeImpact(impact, 'en')).toBe('page direction changed.');
    expect(describeImpact(impact, 'ar')).toBe('تغيير اتجاه الصفحة.');
  });

  it('says a plan changes NOTHING when it truly does', () => {
    /*
      The case a step list cannot tell you. A `setProp` to the value already
      there is a valid command that produces an identical document: the plan
      reads like work and does none. Someone about to press Apply should be told
      that before they spend an undo step finding out.
    */
    const same = doc({
      ...page(['a']),
      a: { id: 'a', type: 'text', props: { content: 'unchanged' } },
    });

    const impact = planImpact(same, doc(structuredClone(same.nodes)));

    expect(impact.empty).toBe(true);
    expect(describeImpact(impact, 'en')).toBe('Changes nothing on the page.');
    expect(describeImpact(impact, 'ar')).toBe('لا يغيّر شيئًا على الصفحة.');
  });

  it('reports a node the plan orphaned, rather than quietly dropping it', () => {
    /*
      An orphan is unreachable from the root, so a walk alone would not see it —
      and "the plan left a node dangling" is exactly the kind of thing an impact
      summary exists to surface.
    */
    const before = doc({ ...page([]) });
    const after = doc({
      ...page([]),
      loose: { id: 'loose', type: 'text', props: {} },
    });

    expect(planImpact(before, after).added).toEqual(['loose']);
  });

  it('does not loop on a document whose slots cycle', () => {
    // Defensive: a cycle cannot pass the kernel's validator, but this function
    // is handed documents by callers and must not hang if one ever does.
    const cyclic = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['a'] } },
      a: { id: 'a', type: 'box', props: {}, slots: { default: ['root'] } },
    });

    expect(planImpact(doc({ ...page([]) }), cyclic).added).toEqual(['a']);
  });
});

describe('describeImpact', () => {
  it('counts rather than listing ids, in both languages', () => {
    /*
      An id is the right thing to JUMP to and the wrong thing to read. Before
      pressing Apply a person needs the size of the change; the ids are already
      on screen in the preview.
    */
    const impact = planImpact(
      doc({ ...page(['a']), a: { id: 'a', type: 'text', props: { content: 'x' } } }),
      doc({
        ...page(['a', 'b']),
        a: { id: 'a', type: 'text', props: { content: 'y' } },
        b: { id: 'b', type: 'text', props: {} },
      }),
    );

    expect(describeImpact(impact, 'en')).toBe('1 block added, 1 block changed.');
    expect(describeImpact(impact, 'ar')).toBe('إضافة 1، تعديل 1.');
  });

  it('uses the singular for one, because "1 blocks" is a bug a reader sees', () => {
    const impact = planImpact(
      doc({ ...page([]) }),
      doc({ ...page(['a']), a: { id: 'a', type: 'text', props: {} } }),
    );

    expect(describeImpact(impact, 'en')).toContain('1 block added');
    expect(describeImpact(impact, 'en')).not.toContain('blocks added');
  });
});

describe('describeCost', () => {
  it('rounds to two significant figures, because a precise number is a false promise', () => {
    /*
      "~4.2k" says estimate; "4,237" says measurement. No model was asked and
      the tokens are counted from canonical JSON — the label and the rounding
      have to agree with that.
    */
    expect(describeCost(4237, 'en')).toBe('Estimate: ~4.2k tokens');
    expect(describeCost(4237, 'ar')).toBe('تقدير: ~4.2k توكن');
  });

  it('does not fake a decimal below a thousand', () => {
    expect(describeCost(842, 'en')).toBe('Estimate: ~842 tokens');
    expect(describeCost(0, 'en')).toBe('Estimate: ~0 tokens');
  });

  it('says ESTIMATE in both languages, because the word is the honest half', () => {
    expect(describeCost(1500, 'en')).toContain('Estimate');
    expect(describeCost(1500, 'ar')).toContain('تقدير');
  });
});
