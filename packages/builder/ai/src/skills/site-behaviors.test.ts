import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_BEHAVIORS,
  customCodeTreeSchema,
} from '@craftkit/builder-schema';

import { normalizeAiPlanTrees } from '../plan/normalize-plan';
import { parseTreeMarkup } from '../plan/tree-markup';
import { CRAFTKIT_AI_SKILL_DEFINITIONS, createCraftkitAiSkillRegistry } from './builtins';
import { SITE_BEHAVIOR_TEACHING } from './site-behaviors';

/*
  The everyday site behaviours (2026-10-13) are taught as one compact line each. A line the door
  refuses costs a section a repair round, and a line the pack cannot read is a dead control, so
  every shape it teaches is landed here exactly the way run-build lands a writer's markup.
*/

function landed(markup: string) {
  const tree = parseTreeMarkup(markup);
  const normalized = normalizeAiPlanTrees({
    rationale: 'r',
    commands: [{ command: 'setProp', args: { id: 'a', key: 'tree', value: tree } }],
  });
  return {
    changes: [...normalized.adjustments, ...normalized.removedClasses, ...normalized.removedIcons],
    door: customCodeTreeSchema.safeParse(tree),
  };
}

const skill = (id: string) =>
  CRAFTKIT_AI_SKILL_DEFINITIONS.find((definition) => definition.id === id);

describe('the ready site behaviours, as taught', () => {
  it('names only behaviours and attributes the door admits', () => {
    const taught = [...SITE_BEHAVIOR_TEACHING.matchAll(/^([a-z-]+): /gmu)].map(
      (match) => match[1] ?? '',
    );
    expect(taught).toEqual([
      'back-to-top',
      'typed-words',
      'count-up',
      'read-more',
      'scroll-spy',
      'filter',
      'dismiss',
    ]);
    for (const name of taught) expect(CUSTOM_CODE_BEHAVIORS).toContain(name);
    const attributes = new Set<string>([...CUSTOM_CODE_ATTRIBUTES, 'class']);
    const written = [...SITE_BEHAVIOR_TEACHING.matchAll(/([A-Za-z][\w-]*)='/gu)].map(
      (match) => match[1] ?? '',
    );
    expect(written.filter((name) => !attributes.has(name))).toEqual([]);
    expect(SITE_BEHAVIOR_TEACHING).not.toMatch(/<script|on[a-z]+=|ck\.root|querySelector/u);
  });

  it('is one compact line per behaviour, under 150 tokens', () => {
    const lines = SITE_BEHAVIOR_TEACHING.split('\n');
    expect(lines).toHaveLength(8);
    expect(Math.ceil(SITE_BEHAVIOR_TEACHING.length / 4)).toBeLessThanOrEqual(150);
  });

  it('reaches the section writer and interaction requests, and stays under the ceilings', () => {
    expect(skill('craftkit.build-fill')?.instructions).toContain(SITE_BEHAVIOR_TEACHING);
    expect(skill('craftkit.motion')?.instructions).toContain(SITE_BEHAVIOR_TEACHING);
    const registry = createCraftkitAiSkillRegistry();
    for (const request of [
      'add a back to top button',
      'أضف زر العودة للأعلى',
      'make the headline a typing effect',
    ]) {
      expect(registry.prepare({ request }).active.map(({ id }) => id)).toContain('craftkit.motion');
    }
    for (const id of ['craftkit.build-fill', 'craftkit.motion']) {
      const prepared = registry.prepare({ request: '', selectedSkillIds: [id], auto: false });
      expect(prepared.totalTokens).toBeLessThan(2_800);
    }
  });

  it.each([
    [
      'back-to-top',
      "<a aria-label='Back to top' class='fixed bottom-6 end-6' data-ck-behavior='back-to-top' href='#top'><icon name='arrow-up'/></a>",
    ],
    [
      'typed-words',
      "<h1>We build <span data-ck-behavior='typed-words'><span>websites</span><span hidden=''>shops</span><span hidden=''>brands</span></span></h1>",
    ],
    ['count-up', "<b data-ck-behavior='count-up' data-ck-to='250'>250+</b>"],
    [
      'read-more',
      "<div data-ck-behavior='read-more' data-ck-text='Show less'><p>A long story about the roastery.</p><button hidden='' type='button'>Read more</button></div>",
    ],
    [
      'scroll-spy',
      "<nav aria-label='Sections' data-ck-behavior='scroll-spy'><a href='#menu'>Menu</a><a href='#visit'>Visit</a></nav>",
    ],
    [
      'filter',
      "<div data-ck-behavior='filter'><div class='flex gap-2'><button aria-pressed='true' data-ck-filter='all' type='button'>All</button><button data-ck-filter='web' type='button'>Web</button></div><ul class='grid gap-4 md:grid-cols-3'><li data-ck-filter='web print'>Menu redesign</li><li data-ck-filter='print'>Posters</li></ul></div>",
    ],
    [
      'dismiss',
      "<div aria-label='Announcement' data-ck-behavior='dismiss' role='region'><p>Free delivery this week</p><button aria-label='Close' hidden='' type='button'><icon name='x'/></button></div>",
    ],
  ])('teaches a %s the door takes as written', (_name, markup) => {
    const { changes, door } = landed(markup);
    expect(door.success, door.success ? '' : door.error.issues[0]?.message).toBe(true);
    expect(changes).toEqual([]);
  });

  it('refuses the shapes its packs cannot read, naming the fix', () => {
    const typed = landed(
      "<span data-ck-behavior='typed-words'><span>websites</span><span>shops</span></span>",
    );
    expect(typed.door.success).toBe(false);
    const message = typed.door.success ? '' : (typed.door.error.issues[0]?.message ?? '');
    expect(message).toMatch(/every one after the first hidden/u);
  });
});
