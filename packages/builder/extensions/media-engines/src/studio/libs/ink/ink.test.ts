// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createDialogueLibrary } from '../dialogue-entry';
import { createInkLibrary } from '../ink-entry';

const I = createInkLibrary();
const D = createDialogueLibrary();

const SOURCE = `VAR courage = 0
Layla: The lantern went out. # emotion:sad # bg:river
* [Cross the river]
  ~ courage += 1
  Omar: Brave.
  -> done
* [Wait for dawn]
  -> done
== done ==
The story ends with courage {courage}.
-> END
`;

describe('ink library', () => {
  it('compiles valid source and reports errors for invalid source', () => {
    expect(I.check(SOURCE)).toEqual([]);
    const errors = I.check('-> nowhere');
    expect(errors.length).toBeGreaterThan(0);
    expect(() => I.compile('-> nowhere')).toThrow(I.InkCompileError);
    expect(() => I.compile('x'.repeat(I.limits.source + 1))).toThrow(RangeError);
  });

  it('presents lines with speakers, tags, cues, choices and variables', () => {
    const cast = D.cast([
      { id: 'layla', name: 'Layla', color: '#f59e0b' },
      { id: 'omar', name: 'Omar' },
    ]);
    const talk = I.dialogue(SOURCE, { cast });
    const first = talk.start();
    expect(first).toMatchObject({
      speaker: 'layla',
      name: 'Layla',
      text: 'The lantern went out.',
      emotion: 'sad',
    });
    expect(first.cue).toEqual({ bg: 'river' });
    expect(first.choices.map((choice) => choice.text)).toEqual([
      'Cross the river',
      'Wait for dawn',
    ]);
    expect(talk.choose(0)).toBe(true);
    expect(talk.current).toMatchObject({ speaker: 'omar', text: 'Brave.', canAdvance: true });
    expect(talk.get('courage')).toBe(1);
    expect(talk.vars).toEqual({ courage: 1 });
    talk.advance();
    expect(talk.current).toMatchObject({ text: 'The story ends with courage 1.', ended: true });
  });

  it('round-trips a save and refuses a malformed one', () => {
    const talk = I.dialogue(SOURCE);
    talk.start();
    const save = JSON.parse(JSON.stringify(talk.save())) as Record<string, unknown>;
    talk.choose(1);
    talk.advance();
    expect(talk.current.ended).toBe(true);
    expect(talk.load(save)).toBe(true);
    expect(talk.current.text).toBe('The lantern went out.');
    expect(talk.current.choices).toHaveLength(2);
    expect(talk.load({ ...save, kind: 'graph' })).toBe(false);
    expect(talk.load({ ...save, state: '{not json' })).toBe(false);
    expect(talk.current.choices).toHaveLength(2);
  });

  it('restarts from the top and loads compiled JSON', () => {
    const story = I.compile(SOURCE) as unknown as { ToJson(): string };
    const json = story.ToJson();
    const talk = I.dialogue(json);
    talk.start();
    talk.choose(0);
    talk.restart();
    expect(talk.get('courage')).toBe(0);
    expect(talk.current.text).toBe('The lantern went out.');
  });

  it('renders through the shared dialogue view', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const view = D.view(I.dialogue(SOURCE), { root, reducedMotion: true });
    expect(root.querySelector('.ckd-name')?.textContent).toBe('Layla');
    expect(root.querySelectorAll('.ckd-choice')).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('.ckd-choice')?.click();
    expect(root.querySelector('.ckd-text')?.textContent).toBe('Brave.');
    view.dispose();
  });

  it('enforces the step limit', () => {
    const talk = I.dialogue('-> loop\n== loop ==\nAgain.\n-> loop', { maxSteps: 5 });
    talk.start();
    expect(() => {
      for (let i = 0; i < 10; i += 1) talk.advance();
    }).toThrow(/step limit/);
  });
});
