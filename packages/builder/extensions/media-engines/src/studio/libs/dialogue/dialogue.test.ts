// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDialogueLibrary } from '../dialogue-entry';
import { compileExpression } from './expression';
import type { DialogueScript } from './engine';

const D = createDialogueLibrary();

const cast = D.cast([
  {
    id: 'layla',
    name: 'ليلى',
    color: '#f59e0b',
    portrait: 'assets/layla.png',
    expressions: { sad: 'assets/layla-sad.png' },
  },
  { id: 'omar', name: 'Omar', color: 0x38bdf8, side: 'end' },
]);

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

describe('dialogue expressions', () => {
  const read = (vars: Record<string, number | string | boolean>) => (name: string) =>
    vars[name] ?? 0;

  it('evaluates comparisons, logic, arithmetic and strings without eval', () => {
    expect(compileExpression('gold >= 3 && !cursed')(read({ gold: 4 }))).toBe(true);
    expect(compileExpression('gold * 2 + 1')(read({ gold: 4 }))).toBe(9);
    expect(compileExpression('(a or b) and not c')(read({ b: true }))).toBe(true);
    expect(compileExpression('"x" + 1')(read({}))).toBe('x1');
    expect(compileExpression('name == "ليلى"')(read({ name: 'ليلى' }))).toBe(true);
    expect(compileExpression('missing')(read({}))).toBe(0);
    expect(compileExpression('10 / 0')(read({}))).toBe(0);
  });

  it('refuses code, long input and deep nesting', () => {
    expect(() => compileExpression('alert(1)')).toThrow(SyntaxError);
    expect(() => compileExpression('a; b')).toThrow(SyntaxError);
    expect(() => compileExpression('constructor.constructor')).not.toThrow(); // just a variable name
    expect(compileExpression('constructor.constructor')(() => 0)).toBe(0);
    expect(() => compileExpression('x'.repeat(300))).toThrow(RangeError);
    expect(() => compileExpression(`${'('.repeat(40)}1${')'.repeat(40)}`)).toThrow(RangeError);
    expect(() => compileExpression('')).toThrow(SyntaxError);
  });
});

describe('cast', () => {
  it('normalises members and resolves by id or name', () => {
    expect(cast.size).toBe(2);
    expect(cast.find('Omar')?.id).toBe('omar');
    expect(cast.find('LAYLA')?.name).toBe('ليلى');
    expect(cast.get('omar')?.color).toBe('#38bdf8');
    expect(cast.portrait('layla', 'sad')).toBe('assets/layla-sad.png');
    expect(cast.portrait('layla', 'happy')).toBe('assets/layla.png');
  });

  it('rejects duplicate ids and unsafe portrait URLs', () => {
    expect(() =>
      D.cast([
        { id: 'a', name: 'A' },
        { id: 'a', name: 'B' },
      ]),
    ).toThrow(TypeError);
    const unsafe = D.cast([{ id: 'a', name: 'A', portrait: 'javascript:alert(1)' }]);
    expect(unsafe.get('a')?.portrait).toBe('');
  });
});

describe('dialogue engine', () => {
  it('plays lines, interpolates variables and resolves the cast', () => {
    const talk = D.create(RIVER, { cast });
    const first = talk.start();
    expect(first).toMatchObject({
      speaker: 'layla',
      name: 'ليلى',
      color: '#f59e0b',
      emotion: 'sad',
      canAdvance: true,
    });
    expect(first.text).toBe('The lantern went out, traveller.');
    expect(talk.advance()).toBe(true);
    expect(talk.current.name).toBe('Omar');
    talk.advance();
    expect(talk.current.choices.map((choice) => [choice.text, choice.enabled])).toEqual([
      ['Cross it', true],
      ['Swim back for the map', false],
      ['Wait for dawn', true],
    ]);
    expect(talk.advance()).toBe(false);
    expect(talk.choose(1)).toBe(false);
  });

  it('applies choice updates, emits cues, follows conditions and reaches an ending', () => {
    const talk = D.create(RIVER, { cast });
    const cues: unknown[] = [];
    const ends: string[] = [];
    talk.on('cue', (line) => cues.push(line.cue));
    talk.on('end', (line) => ends.push(line.ending));
    talk.start();
    talk.advance();
    talk.advance();
    expect(talk.choose(0)).toBe(true);
    expect(talk.get('courage')).toBe(1);
    expect(cues).toEqual([{ fx: 'splash' }]);
    talk.advance();
    expect(talk.current).toMatchObject({
      text: 'Courage 1. Onward.',
      ended: true,
      ending: 'brave',
      canAdvance: false,
    });
    expect(ends).toEqual(['brave']);
    expect(talk.history.map((entry) => entry.text)).toContain('› Cross it');
  });

  it('saves and restores a validated state without replaying side effects', () => {
    const talk = D.create(RIVER, { cast });
    talk.start();
    talk.advance();
    talk.advance();
    talk.choose(0);
    const save = JSON.parse(JSON.stringify(talk.save())) as unknown;
    const again = D.create(RIVER, { cast });
    expect(again.load(save)).toBe(true);
    expect(again.current.text).toBe('The water is cold.');
    expect(again.get('courage')).toBe(1);
    expect(again.load({ ...(save as object), at: 'nowhere' })).toBe(false);
    expect(again.load({ ...(save as object), v: 2 })).toBe(false);
    expect(again.load({ ...(save as object), vars: { courage: { evil: true } } })).toBe(false);
    expect(again.current.text).toBe('The water is cold.');
  });

  it('restart resets variables and history', () => {
    const talk = D.create(RIVER);
    talk.start();
    talk.advance();
    talk.advance();
    talk.choose(0);
    talk.restart();
    expect(talk.get('courage')).toBe(0);
    expect(talk.history).toHaveLength(1);
  });

  it('validates every jump target before starting', () => {
    expect(() => D.check({ start: 'a', nodes: { a: { text: 'x', next: 'b' } } })).toThrow(
      /unknown targets/,
    );
    expect(() =>
      D.check({ start: 'a', nodes: { a: { text: 'x', choices: [{ text: 'go', to: '' }] } } }),
    ).toThrow(/no "to"/);
    expect(() => D.check({ start: 'a', nodes: { a: { text: 'x', if: 'eval(' } } })).toThrow(
      TypeError,
    );
    expect(() => D.check({ start: 'a', nodes: { 'bad id!': { text: 'x' } } })).toThrow(TypeError);
    expect(D.check({ start: 'a', nodes: { a: { text: 'x' } } })).toBe(true);
  });

  it('stops a loop of silent nodes instead of freezing', () => {
    const talk = D.create({ start: 'a', nodes: { a: { next: 'b' }, b: { next: 'a' } } });
    expect(() => talk.start()).toThrow(RangeError);
  });

  it('enforces the step limit', () => {
    const talk = D.create(
      { start: 'a', nodes: { a: { text: 'again', next: 'a' } } },
      { maxSteps: 3 },
    );
    talk.start();
    talk.advance();
    talk.advance();
    expect(() => talk.advance()).toThrow(/step limit/);
  });

  it('picks random branches with the given rng and hides once-only choices', () => {
    const talk = D.create(
      {
        start: 'pick',
        nodes: {
          pick: { random: ['a', 'b'] },
          a: { text: 'A', next: 'menu' },
          b: { text: 'B', next: 'menu' },
          menu: {
            text: 'Ask',
            choices: [
              { text: 'Once', to: 'menu', once: true },
              { text: 'Leave', to: 'end' },
            ],
          },
          end: { text: 'Bye', end: true },
        },
      },
      { rng: () => 0.9 },
    );
    expect(talk.start().text).toBe('B');
    talk.advance();
    talk.choose(0);
    expect(talk.current.choices.map((choice) => choice.text)).toEqual(['Leave']);
  });
});

describe('dialogue view', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.getElementById('ckd-style')?.remove();
  });

  function mount(lang = 'en', options: Record<string, unknown> = {}) {
    const root = document.createElement('div');
    root.setAttribute('lang', lang);
    document.body.appendChild(root);
    const talk = D.create(RIVER, { cast });
    const view = D.view(talk, { root, reducedMotion: true, ...options });
    return { root, talk, view };
  }

  it('renders an accessible box with live text, speaker and continue button', () => {
    const { root, view } = mount();
    const live = root.querySelector('[aria-live=polite]');
    expect(live?.textContent).toBe('ليلى: The lantern went out, traveller.');
    expect(root.querySelector('.ckd-name')?.textContent).toBe('ليلى');
    expect(root.querySelector<HTMLImageElement>('.ckd-portrait')?.getAttribute('src')).toBe(
      'assets/layla-sad.png',
    );
    const next = root.querySelector<HTMLButtonElement>('.ckd-primary');
    expect(next?.textContent).toBe('Continue');
    next?.click();
    expect(root.querySelector('.ckd-name')?.textContent).toBe('Omar');
    expect(document.getElementById('ckd-style')).not.toBeNull();
    view.dispose();
    expect(root.querySelector('.ckd')).toBeNull();
  });

  it('offers numbered choices, disables locked ones and accepts number keys', () => {
    const { root, talk } = mount();
    talk.advance();
    talk.advance();
    const choices = [...root.querySelectorAll<HTMLButtonElement>('.ckd-choice')];
    expect(choices).toHaveLength(3);
    expect(choices[1]?.disabled).toBe(true);
    root
      .querySelector('.ckd')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    expect(talk.current.text).toBe('Dawn comes slowly.');
    expect(root.querySelector('.ckd-primary')?.textContent).toBe('Play again');
  });

  it('uses Arabic labels on an Arabic page and stays inert in the editor', () => {
    const { root, talk } = mount('ar', { interactive: false });
    const next = root.querySelector<HTMLButtonElement>('.ckd-primary');
    expect(next?.textContent).toBe('متابعة');
    expect(next?.disabled).toBe(true);
    next?.click();
    expect(talk.current.speaker).toBe('layla');
  });

  it('types visually but completes the line on the first press', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const talk = D.create(RIVER, { cast });
    D.view(talk, { root, speed: 10 });
    const text = root.querySelector('.ckd-text');
    expect(text?.textContent).toBe('');
    vi.advanceTimersByTime(400);
    expect(text?.textContent.length).toBeGreaterThan(0);
    root.querySelector<HTMLButtonElement>('.ckd-primary')?.click();
    expect(text?.textContent).toBe('The lantern went out, traveller.');
    expect(talk.current.speaker).toBe('layla');
    vi.useRealTimers();
  });
});
