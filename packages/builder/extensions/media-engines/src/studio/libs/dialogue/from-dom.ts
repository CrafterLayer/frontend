/*
  A dialogue script read from the section's tree (creative engines, 2026-10-12):
  `s.lib.dialogue.fromDom(ck.root, logic?)`. The words of a story stay in the region's markup,
  where page.translate translates them as ordinary element text and a person edits them; the
  scene code adds only logic. The markup (admitted by the tree door with these exact names,
  schema custom-code/dialogue-vocabulary.ts):

    <ol data-ck-dialogue hidden>                 data-ck-dialogue='id' starts there instead
      <li data-ck-speaker='layla'>The lantern went out.</li>
      <li data-ck-node='ask' data-ck-speaker='omar'>Cross the river?
        <button data-ck-next='cross'>Cross it</button>
        <button data-ck-next='wait'>Wait for dawn</button></li>
      <li data-ck-node='cross' data-ck-ending='brave'>The water is cold.</li>
      <li data-ck-node='wait' data-ck-ending='patient'>Dawn comes slowly.</li>
    </ol>

  One <li> is one line, and lines play top to bottom like a script: data-ck-next jumps, the
  buttons inside a line are its choices (each one's data-ck-next is where it goes), and
  data-ck-ending ends (bare: no named ending) — so every branch ends with a jump or an ending.
  data-ck-node names a line for jumps and logic; an unnamed line is "line-<n>" (1-based).

  `logic` merges by node id what words are not: vars, if/else, set, cue, emotion, tags, random,
  next/end, and per choice (by index) if/set/once/showLocked. A node it names that the markup
  does not have is a logic-only node (a silent if/else). Words there are refused, so they cannot
  drift back into code. The result is a plain object script that compileDialogue has checked
  with the same limits as a script written in code; `create`, `check` and saves treat it alike
  (an unset speaker or ending stays null, which the compiler reads as none). Every byte here
  counts against the lib's gzip budget, so the checks the compiler makes are not repeated.
*/

import { compileDialogue, fail, type DialogueNodeInput, type DialogueScript } from './script';

type Fields = Record<string, unknown>;

/** What scene code may add to a script read from the markup: everything but the words. */
export interface DialogueLogic {
  vars?: DialogueScript['vars'];
  nodes?: Readonly<Record<string, Readonly<Fields>>>;
}

const WORDS = ['text', 'lines', 'speaker'];

const read = (el: Element, name: string): string | null => el.getAttribute(`data-ck-${name}`);

/** Visible words as a person means them: whitespace runs as one space, trimmed. */
const words = (node: Node): string => (node.textContent ?? '').replace(/\s+/gu, ' ').trim();

function fields(value: unknown, where: string, refused: readonly string[]): Fields {
  if (typeof value !== 'object' || value === null) fail(`${where} must be an object`);
  for (const key of refused)
    if (key in value) fail(`${where} sets "${key}": words stay in the markup`);
  return value as Fields;
}

/** The script a `[data-ck-dialogue]` list holds (`root` is the list or contains it). */
export function scriptFromDom(root: unknown, logic: unknown = {}): DialogueScript {
  const el = root as Partial<Element> | null | undefined;
  const list = el?.querySelector?.('[data-ck-dialogue]') ?? el;
  const items = [...(list?.children ?? [])].filter((child) => child.localName === 'li');
  if (items.length === 0) fail('no [data-ck-dialogue] list of <li> lines to read');
  const ids = items.map((li, index) => read(li, 'node') ?? `line-${String(index + 1)}`);
  const nodes = Object.create(null) as Record<string, Fields>;
  items.forEach((li, index) => {
    const id = ids[index] ?? '';
    if (id in nodes) fail(`two lines are named "${id}"`);
    // The line's words are its own, without its buttons: each button is a choice. A choice without
    // data-ck-next is "a choice with no to", which compileDialogue names below.
    const line = li.cloneNode(true) as Element;
    const choices = [...line.querySelectorAll('button')].map((button) => {
      button.remove();
      return { text: words(button), to: read(button, 'next') ?? '' };
    });
    const ending = read(li, 'ending');
    nodes[id] = {
      speaker: read(li, 'speaker'),
      text: words(line),
      choices,
      next:
        read(li, 'next') ?? (choices.length > 0 || ending !== null ? '' : (ids[index + 1] ?? '')),
      end: ending !== null,
      ending,
    };
  });
  const extra = (logic ?? {}) as Fields;
  for (const [id, value] of Object.entries(extra['nodes'] ?? {})) {
    const where = `node "${id}"`;
    const { choices = [], ...rest } = fields(value, where, WORDS);
    // A node the markup does not have is a logic-only node: a silent if/else, random or jump.
    const node = Object.assign((nodes[id] ??= { choices: [] }), rest);
    const own = node['choices'] as Readonly<Record<string, Fields>>;
    for (const [at, choice] of Object.entries(choices as object))
      Object.assign(
        own[at] ?? fail(`${where} has no choice ${at}`),
        fields(choice, `${where} choice ${at}`, ['text', 'to']),
      );
  }
  const script = {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- a bare marker starts at the top
    start: read(list as Element, 'dialogue') || (ids[0] ?? ''),
    vars: (extra['vars'] ?? {}) as NonNullable<DialogueScript['vars']>,
    nodes: nodes as Record<string, DialogueNodeInput>,
  };
  compileDialogue(script);
  return script;
}
