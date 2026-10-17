// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { createDialogueLibrary } from '../dialogue-entry';
import type { DialogueScript } from './engine';
import type { DialogueLike, DialogueLine } from './types';

/*
  s.lib.dialogue.fromDom (creative engines, 2026-10-12): a story's words live in the section's
  tree, so page.translate and a person reach them; the code adds only logic. A script read from
  the markup must play exactly like the same script written as an object.
*/

const D = createDialogueLibrary();

const cast = D.cast([
  { id: 'layla', name: 'ليلى', color: '#f59e0b' },
  { id: 'omar', name: 'Omar', color: 0x38bdf8 },
]);

/** The dialogue tests' river story, as an object script. */
const RIVER: DialogueScript = {
  start: 'intro',
  vars: { courage: 0, name: 'traveller' },
  nodes: {
    intro: {
      lines: [
        ['layla', 'The lantern went out, {name}.', 'sad'],
        ['omar', 'Then we walk by starlight.'],
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'layla',
      text: 'Cross the river?',
      choices: [
        { text: 'Cross it', to: 'cross', set: { courage: '+=1' } },
        { text: 'Swim back for the map', to: 'map', if: 'courage >= 1', showLocked: true },
        { text: 'Wait for dawn', to: 'wait' },
      ],
    },
    cross: { text: 'The water is cold.', cue: { fx: 'splash' }, next: 'check' },
    check: { if: 'courage > 0 and name == "traveller"', else: 'wait', next: 'brave' },
    brave: { speaker: 'omar', text: 'Courage {courage}. Onward.', end: true, ending: 'brave' },
    map: { text: 'You find the map.', end: true, ending: 'map' },
    wait: { text: 'Dawn comes slowly.', end: true, ending: 'patient' },
  },
};

/** The same story with its words in the tree. */
const RIVER_MARKUP = `<section><h2>The river</h2><ol data-ck-dialogue="intro" hidden>
  <li data-ck-node="intro" data-ck-speaker="layla">The lantern went out, {name}.</li>
  <li data-ck-speaker="omar">Then   we walk
    by <b>starlight</b>.</li>
  <li data-ck-node="ask" data-ck-speaker="layla">Cross the river?
    <button type="button" data-ck-next="cross">Cross it</button>
    <button type="button" data-ck-next="map">Swim back for the map</button>
    <button type="button" data-ck-next="wait">Wait for dawn</button></li>
  <li data-ck-node="cross" data-ck-next="check">The water is cold.</li>
  <li data-ck-node="brave" data-ck-speaker="omar" data-ck-ending="brave">Courage {courage}. Onward.</li>
  <li data-ck-node="map" data-ck-ending="map">You find the map.</li>
  <li data-ck-node="wait" data-ck-ending="patient">Dawn comes slowly.</li>
</ol></section>`;

/** Only the logic: vars, an emotion, choice updates and conditions, a cue and a silent branch. */
const RIVER_LOGIC = {
  vars: { courage: 0, name: 'traveller' },
  nodes: {
    intro: { emotion: 'sad' },
    ask: { choices: [{ set: { courage: '+=1' } }, { if: 'courage >= 1', showLocked: true }] },
    cross: { cue: { fx: 'splash' } },
    check: { if: 'courage > 0 and name == "traveller"', else: 'wait', next: 'brave' },
  },
};

function section(markup: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.appendChild(root);
  return root;
}

/** What a person sees of a line (its node id aside, which differs between the two scripts). */
function seen(line: DialogueLine) {
  return Object.fromEntries(
    Object.entries(line).filter(([key]) => key !== 'id' && key !== 'character'),
  );
}

/** Play `moves` (a number chooses, 'next' advances) and record every line shown. */
function play(talk: DialogueLike, moves: readonly (number | 'next')[]) {
  const shown = [seen(talk.start())];
  for (const move of moves) {
    if (move === 'next') talk.advance();
    else talk.choose(move);
    shown.push(seen(talk.current));
  }
  return { shown, vars: talk.vars, history: talk.history };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('dialogue.fromDom — the same story as the object script', () => {
  it.each<[string, readonly (number | 'next')[]]>([
    ['the brave ending', ['next', 'next', 0, 'next']],
    ['the patient ending', ['next', 'next', 2]],
    ['a locked choice', ['next', 'next', 1, 2]],
  ])('plays %s line for line', (_name, moves) => {
    const script = D.fromDom(section(RIVER_MARKUP), RIVER_LOGIC);
    expect(play(D.create(script, { cast }), moves)).toEqual(play(D.create(RIVER, { cast }), moves));
  });

  it('reads speakers through the cast, collapses whitespace and keeps inline markup words', () => {
    const talk = D.create(D.fromDom(section(RIVER_MARKUP), RIVER_LOGIC), { cast });
    expect(talk.start()).toMatchObject({
      speaker: 'layla',
      name: 'ليلى',
      color: '#f59e0b',
      emotion: 'sad',
      text: 'The lantern went out, traveller.',
    });
    talk.advance();
    expect(talk.current).toMatchObject({ name: 'Omar', text: 'Then we walk by starlight.' });
  });

  it('keeps a line words apart from its choices, and the choices in order', () => {
    const script = D.fromDom(section(RIVER_MARKUP), RIVER_LOGIC);
    expect(script.nodes['ask']).toMatchObject({
      text: 'Cross the river?',
      choices: [
        { text: 'Cross it', to: 'cross', set: { courage: '+=1' } },
        { text: 'Swim back for the map', to: 'map', if: 'courage >= 1', showLocked: true },
        { text: 'Wait for dawn', to: 'wait' },
      ],
    });
  });

  it('saves and restores like any script', () => {
    const talk = D.create(D.fromDom(section(RIVER_MARKUP), RIVER_LOGIC), { cast });
    talk.start();
    talk.advance();
    talk.advance();
    talk.choose(0);
    const again = D.create(D.fromDom(section(RIVER_MARKUP), RIVER_LOGIC), { cast });
    expect(again.load(JSON.parse(JSON.stringify(talk.save())))).toBe(true);
    expect(again.current.text).toBe('The water is cold.');
    expect(again.get('courage')).toBe(1);
  });

  it('plays a translated tree in the new words, with the same logic', () => {
    const root = section(RIVER_MARKUP);
    const ask = root.querySelector('[data-ck-node=ask]');
    const question = ask?.firstChild;
    if (question) ask.replaceChild(document.createTextNode('نعبر النهر؟'), question);
    const first = ask?.querySelector('button');
    if (first) first.textContent = 'نعبره';
    const talk = D.create(D.fromDom(root, RIVER_LOGIC), { cast });
    talk.start();
    talk.advance();
    talk.advance();
    expect(talk.current.text).toBe('نعبر النهر؟');
    expect(talk.current.choices[0]?.text).toBe('نعبره');
    talk.choose(0);
    expect(talk.get('courage')).toBe(1);
  });
});

describe('dialogue.fromDom — markup rules', () => {
  it('plays top to bottom, names unnamed lines line-<n> and ends on the last line', () => {
    const script = D.fromDom(
      section(
        '<ol data-ck-dialogue><li>One</li><li data-ck-node="two">Two</li><li>Three</li></ol>',
      ),
    );
    expect(script).toEqual({
      start: 'line-1',
      vars: {},
      nodes: {
        'line-1': {
          speaker: null,
          text: 'One',
          choices: [],
          next: 'two',
          end: false,
          ending: null,
        },
        two: { speaker: null, text: 'Two', choices: [], next: 'line-3', end: false, ending: null },
        'line-3': { speaker: null, text: 'Three', choices: [], next: '', end: false, ending: null },
      },
    });
    const talk = D.create(script);
    talk.start();
    talk.advance();
    talk.advance();
    expect(talk.current).toMatchObject({ text: 'Three', ended: true, ending: '' });
  });

  it('accepts the list itself, starts where data-ck-dialogue says, and ends on a bare ending', () => {
    const root = section(
      '<ol data-ck-dialogue="b"><li data-ck-ending>A</li><li data-ck-node="b">B</li><li>C</li></ol>',
    );
    const list = root.querySelector('ol');
    const talk = D.create(D.fromDom(list as Element));
    expect(talk.start().text).toBe('B');
    talk.advance();
    expect(talk.current.text).toBe('C');
    expect(D.create(D.fromDom(root), {}).start('line-1')).toMatchObject({
      text: 'A',
      ended: true,
    });
  });

  it('a jump wins over the next line; logic may add a silent node the markup jumps to', () => {
    const root = section(`<ol data-ck-dialogue>
      <li data-ck-next="gate">Knock.</li>
      <li data-ck-node="in" data-ck-ending="inside">The door opens.</li>
      <li data-ck-node="out" data-ck-ending="outside">Nobody answers.</li></ol>`);
    const logic = { vars: { key: true }, nodes: { gate: { if: 'key', else: 'out', next: 'in' } } };
    const open = D.create(D.fromDom(root, logic));
    open.start();
    open.advance();
    expect(open.current).toMatchObject({ text: 'The door opens.', ending: 'inside' });
    const shut = D.create(D.fromDom(root, { ...logic, vars: { key: false } }));
    shut.start();
    shut.advance();
    expect(shut.current).toMatchObject({ text: 'Nobody answers.', ending: 'outside' });
  });
});

describe('dialogue.fromDom — clear errors', () => {
  it.each<[string, string, unknown, RegExp]>([
    ['no list', '<p>Hello</p>', undefined, /no \[data-ck-dialogue\] list/u],
    ['an empty list', '<ol data-ck-dialogue></ol>', undefined, /list of <li> lines/u],
    [
      'a name used twice',
      '<ol data-ck-dialogue><li data-ck-node="a">A</li><li data-ck-node="a">B</li></ol>',
      undefined,
      /two lines are named "a"/u,
    ],
    [
      'a choice that goes nowhere',
      '<ol data-ck-dialogue><li>Go?<button>Yes</button></li></ol>',
      undefined,
      /unknown targets: line-1 → a choice with no "to"/u,
    ],
    [
      'a jump to no line',
      '<ol data-ck-dialogue><li data-ck-next="nowhere">A</li></ol>',
      undefined,
      /unknown targets: line-1 → "nowhere"/u,
    ],
    [
      'a bad line name',
      '<ol data-ck-dialogue><li data-ck-node="two words">A</li></ol>',
      undefined,
      /node id "two words" must be 1\.\.64 letters/u,
    ],
    [
      'a choice with no words',
      '<ol data-ck-dialogue><li>Go?<button data-ck-next="line-1"> </button></li></ol>',
      undefined,
      /choice 0 needs text/u,
    ],
    [
      'words in the logic',
      '<ol data-ck-dialogue><li>A</li></ol>',
      { nodes: { 'line-1': { text: 'B' } } },
      /node "line-1" sets "text": words stay in the markup/u,
    ],
    [
      'a speaker in the logic',
      '<ol data-ck-dialogue><li>A</li></ol>',
      { nodes: { extra: { speaker: 'omar' } } },
      /sets "speaker"/u,
    ],
    [
      'a choice label in the logic',
      '<ol data-ck-dialogue><li>Go?<button data-ck-next="line-1">Again</button></li></ol>',
      { nodes: { 'line-1': { choices: [{ text: 'Other' }] } } },
      /choice 0 sets "text"/u,
    ],
    [
      'logic for a choice the line does not have',
      '<ol data-ck-dialogue><li>A</li></ol>',
      { nodes: { 'line-1': { choices: [{ once: true }] } } },
      /has no choice 0/u,
    ],
    [
      'a bad condition',
      '<ol data-ck-dialogue><li>A</li></ol>',
      { nodes: { 'line-1': { if: 'alert(1)' } } },
      /node "line-1" "if"/u,
    ],
  ])('names %s', (_name, markup, logic, message) => {
    const root = section(markup);
    expect(() => D.fromDom(root, logic as never)).toThrow(TypeError);
    expect(() => D.fromDom(root, logic as never)).toThrow(message);
  });

  it('refuses something that is not an element', () => {
    expect(() => D.fromDom(null as never)).toThrow(/no \[data-ck-dialogue\] list/u);
    expect(() => D.fromDom({} as never)).toThrow(TypeError);
  });
});

describe('dialogue.fromDom — the object script limits', () => {
  const lines = (count: number, inner = (index: number) => `Line ${String(index)}`) =>
    `<ol data-ck-dialogue>${Array.from({ length: count }, (_, index) => `<li>${inner(index)}</li>`).join('')}</ol>`;

  it('holds 512 lines and refuses 513', () => {
    expect(D.check(D.fromDom(section(lines(D.limits.nodes))))).toBe(true);
    expect(() => D.fromDom(section(lines(D.limits.nodes + 1)))).toThrow(/needs 1\.\.512 nodes/u);
  });

  it('holds 8 choices and refuses 9', () => {
    const buttons = (count: number) =>
      `<ol data-ck-dialogue><li>Pick${'<button data-ck-next="line-1">Again</button>'.repeat(count)}</li></ol>`;
    expect(D.check(D.fromDom(section(buttons(D.limits.choices))))).toBe(true);
    expect(() => D.fromDom(section(buttons(D.limits.choices + 1)))).toThrow(/more than 8 choices/u);
  });

  it('cuts a line at the text limit, as a script in code is cut', () => {
    const long = 'a'.repeat(D.limits.text + 50);
    const talk = D.create(D.fromDom(section(lines(1, () => long))));
    expect(talk.start().text).toHaveLength(D.limits.text);
    expect(D.create({ start: 'a', nodes: { a: { text: long } } }).start().text).toHaveLength(
      D.limits.text,
    );
  });
});
