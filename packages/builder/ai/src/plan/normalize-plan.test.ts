import { describe, expect, it } from 'vitest';

import { normalizeAiPlanTrees, readAiPlanTreeMarkup } from './normalize-plan';

function planWith(children: unknown[]) {
  return {
    rationale: 'fill a region',
    commands: [
      {
        command: 'setProp',
        args: { id: 'pg-0006', key: 'tree', value: { kind: 'root', children } },
        title: 'Drinks',
      },
    ],
  };
}

function treeOf(plan: unknown): unknown {
  return (plan as ReturnType<typeof planWith>).commands[0]?.args.value;
}

/*
  Measured 2026-09-27: a whole section plan was refused — and re-requested for
  another 25-40 seconds — because one tree used `border-emerald-900/20`, an
  ordinary Tailwind class the site vocabulary happens not to generate. A class
  with no CSS renders as nothing; removing it before the door costs the section
  that one class instead of the whole section.
*/
describe('normalizeAiPlanTrees', () => {
  it('removes the classes that have no generated CSS and keeps the rest', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'section',
          className: 'py-24 border-emerald-900/20 totally-made-up bg-stone-50',
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'section', className: 'py-24 bg-stone-50' }],
    });
    expect(result.removedClasses).toEqual(['border-emerald-900/20', 'totally-made-up']);
  });

  it('keeps the region-local ck- classes a tree styles in its own css', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'element', tag: 'div', className: 'ck-hero-glow p-4' }]),
    );

    expect(result.removedClasses).toEqual([]);
    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-hero-glow p-4' }],
    });
  });

  it('drops a className that had nothing usable left in it', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'element', tag: 'p', className: 'made-up-one made-up-two', text: 'Hi' }]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'p', text: 'Hi' }],
    });
  });

  it('cleans nested children and icon classes too', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'ul',
          children: [
            {
              kind: 'element',
              tag: 'li',
              className: 'text-emerald-900/70 flex',
              children: [{ kind: 'icon', name: 'coffee', className: 'nope-class size-5' }],
            },
          ],
        },
      ]),
    );

    expect(result.removedClasses).toEqual(['text-emerald-900/70', 'nope-class']);
    expect(JSON.stringify(result.plan)).not.toContain('nope-class');
    expect(JSON.stringify(result.plan)).toContain('"name":"coffee"');
  });

  it('removes an icon the Lucide set does not have, instead of refusing the section', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'div',
          children: [
            { kind: 'icon', name: 'definitely-not-an-icon' },
            { kind: 'element', tag: 'span', text: 'Open daily' },
          ],
        },
      ]),
    );

    expect(result.removedIcons).toEqual(['definitely-not-an-icon']);
    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          children: [{ kind: 'element', tag: 'span', text: 'Open daily' }],
        },
      ],
    });
  });

  it('returns the very same plan when there is nothing to clean', () => {
    const plan = planWith([{ kind: 'element', tag: 'h2', className: 'text-3xl', text: 'Menu' }]);
    const result = normalizeAiPlanTrees(plan);

    expect(result.plan).toBe(plan);
    expect(result.removedClasses).toEqual([]);
    expect(result.removedIcons).toEqual([]);
  });

  it('leaves anything that is not a plan untouched', () => {
    for (const value of [null, 'text', 42, { rationale: 'x' }, []]) {
      expect(normalizeAiPlanTrees(value).plan).toBe(value);
    }
  });

  it('finds trees wherever the args carry them', () => {
    const plan = {
      rationale: 'insert',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: {
              tree: {
                kind: 'root',
                children: [{ kind: 'element', tag: 'div', className: 'x-y-z p-2' }],
              },
            },
          },
        },
      ],
    };

    expect(JSON.stringify(normalizeAiPlanTrees(plan).plan)).toContain('"className":"p-2"');
  });
});

describe('normalizeAiPlanTrees — the tree vocabulary', () => {
  /*
    2026-09-27: a contact section built as a form (form, label, input,
    textarea) was refused whole as "Invalid input". The vocabulary has no
    controls on purpose; the section's words and layout still belong on the page.
  */
  it('keeps a form section as layout and drops the controls nothing could wire up', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'form',
          className: 'grid gap-4',
          children: [
            { kind: 'element', tag: 'label', text: 'Your name' },
            { kind: 'element', tag: 'input', className: 'border-2' },
            { kind: 'element', tag: 'textarea' },
            { kind: 'element', tag: 'button', text: 'Send' },
          ],
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'grid gap-4',
          children: [
            { kind: 'element', tag: 'span', text: 'Your name' },
            { kind: 'element', tag: 'button', text: 'Send' },
          ],
        },
      ],
    });
    expect(result.adjustments).toEqual(
      expect.arrayContaining(['form → div', 'label → span', 'dropped input', 'dropped textarea']),
    );
  });

  it('respells b and i as their vocabulary tags', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        { kind: 'element', tag: 'b', text: 'Bold' },
        { kind: 'element', tag: 'I', text: 'Lean' },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        { kind: 'element', tag: 'strong', text: 'Bold' },
        { kind: 'element', tag: 'em', text: 'Lean' },
      ],
    });
  });

  it('moves an attribute written beside the tag into attributes, and drops what is not one', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        {
          kind: 'element',
          tag: 'a',
          href: '#menu',
          text: 'Menu',
          attributes: { rel: 'nofollow', 'aria-label': 'Open the menu', width: 40 },
        },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'a',
          text: 'Menu',
          attributes: { 'aria-label': 'Open the menu', href: '#menu' },
        },
      ],
    });
  });

  it('bounds icon numbers to what the schema admits and drops unknown icon keys', () => {
    const result = normalizeAiPlanTrees(
      planWith([{ kind: 'icon', name: 'coffee', size: 400.5, strokeWidth: 9, color: 'red' }]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [{ kind: 'icon', name: 'coffee', size: 256, strokeWidth: 4 }],
    });
  });

  it('turns a text node and a kind-less element into vocabulary elements', () => {
    const result = normalizeAiPlanTrees(
      planWith([
        { kind: 'text', text: 'Hello' },
        { tag: 'p', text: 'World' },
      ]),
    );

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        { kind: 'element', tag: 'span', text: 'Hello' },
        { kind: 'element', tag: 'p', text: 'World' },
      ],
    });
  });

  it('leaves a vocabulary-clean tree with attributes as the very same object', () => {
    const plan = planWith([
      {
        kind: 'element',
        tag: 'img',
        className: 'rounded-2xl',
        attributes: { src: 'https://example.com/a.jpg', alt: 'A cup' },
      },
    ]);

    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

describe('normalizeAiPlanTrees — one setProp per prop', () => {
  it('splits a css key written inside the tree setProp into its own setProp', () => {
    const tree = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-glow' }],
    };
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: { id: 'pg-5', key: 'tree', value: tree, css: '.ck-glow{filter:blur(40px)}' },
          title: 'Hero',
        },
      ],
    });

    expect(result.plan).toEqual({
      rationale: 'fill',
      commands: [
        { command: 'setProp', args: { id: 'pg-5', key: 'tree', value: tree }, title: 'Hero' },
        {
          command: 'setProp',
          args: { id: 'pg-5', key: 'css', value: '.ck-glow{filter:blur(40px)}' },
        },
      ],
    });
    expect(result.adjustments).toContain('split css into its own setProp');
  });

  it('leaves a setProp that is already one prop untouched', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

describe('normalizeAiPlanTrees — trees written as markup', () => {
  it('reads a setProp tree written as markup into the tree, then cleans it', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'pg-6',
            key: 'tree',
            value:
              "<section class='py-16 totally-made-up'><form><h2>تواصل</h2><input></form></section>",
          },
        },
      ],
    });

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [
            {
              kind: 'element',
              tag: 'div',
              children: [{ kind: 'element', tag: 'h2', text: 'تواصل' }],
            },
          ],
        },
      ],
    });
    expect(result.adjustments).toContain('read tree markup');
  });

  it('reads an insertNode tree prop written as markup', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'insert',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: { label: 'Menu', tree: "<section><h2 class='text-3xl'>Menu</h2></section>" },
          },
        },
      ],
    });

    expect(JSON.stringify(result.plan)).toContain(
      '"tree":{"kind":"root","children":[{"kind":"element","tag":"section","children":[{"kind":"element","tag":"h2","className":"text-3xl","text":"Menu"}]}]}',
    );
  });

  it('reads ck-component into a component reference, never a div', () => {
    const result = normalizeAiPlanTrees({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'pg-6',
            key: 'tree',
            value:
              "<section class='py-16'><h2>Contact</h2><ck-component type='contact' props='{\"email\":\"a@b.co\"}'></ck-component></section>",
          },
        },
      ],
    });

    expect(treeOf(result.plan)).toEqual({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [
            { kind: 'element', tag: 'h2', text: 'Contact' },
            { kind: 'component', component: 'contact', props: { email: 'a@b.co' } },
          ],
        },
      ],
    });
    expect(result.adjustments).not.toContain('ck-component → div');
  });

  it('leaves a tag that names a registered block for the door to refuse, instead of an empty div', () => {
    const result = normalizeAiPlanTrees(
      {
        rationale: 'fill',
        commands: [
          {
            command: 'setProp',
            args: {
              id: 'pg-6',
              key: 'tree',
              value: '<section><contact></contact><formSection/><aside>kept</aside></section>',
            },
          },
        ],
      },
      'free',
      ['contact', 'formSection'],
    );

    expect(JSON.stringify(treeOf(result.plan))).toBe(
      '{"kind":"root","children":[{"kind":"element","tag":"section","children":[{"kind":"element","tag":"contact"},{"kind":"element","tag":"formsection"},{"kind":"element","tag":"aside","text":"kept"}]}]}',
    );
    expect(result.adjustments.join(' ')).not.toMatch(/contact → div|formsection → div/u);
  });

  it('leaves a label or any other string prop alone even when it starts with <', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } }],
    };
    expect(normalizeAiPlanTrees(plan).plan).toBe(plan);
  });
});

/*
  Markup is a spelling, not a vocabulary rule: the context always tells the
  model to write trees as markup, so a host that turns the vocabulary check
  off must still have them read — or every tree reaches the door as a string.
*/
describe('readAiPlanTreeMarkup', () => {
  it('reads every tree written as markup and cleans nothing else', () => {
    const plan = {
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'a',
            key: 'tree',
            value: "<section class='made-up-class'><form>x</form></section>",
          },
        },
        {
          command: 'insertNode',
          args: { type: 'customCode', parentId: 'root', props: { tree: '<p>Hi</p>' } },
        },
        { command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } },
      ],
    };

    expect(readAiPlanTreeMarkup(plan)).toEqual({
      rationale: 'fill',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'a',
            key: 'tree',
            value: {
              kind: 'root',
              children: [
                {
                  kind: 'element',
                  tag: 'section',
                  className: 'made-up-class',
                  children: [{ kind: 'element', tag: 'form', text: 'x' }],
                },
              ],
            },
          },
        },
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: {
              tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Hi' }] },
            },
          },
        },
        { command: 'setProp', args: { id: 'a', key: 'label', value: '<3 coffee' } },
      ],
    });
  });

  it('returns the very same plan when no tree is written as markup', () => {
    const plan = {
      rationale: 'r',
      commands: [{ command: 'setProp', args: { id: 'a', key: 'k', value: 1 } }],
    };
    expect(readAiPlanTreeMarkup(plan)).toBe(plan);
  });
});
