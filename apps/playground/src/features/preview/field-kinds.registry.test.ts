import { createElement } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { z } from 'zod';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  Inspector,
  blockPartsOf,
  propsShapeOf,
  repeaterSchemaInfo,
  resolveField,
  unwrapSchema,
  type BlockParts,
  type BlockPropertyGroup,
  type BlockPropertyKind,
  type BlockSchema,
  type BuilderKernel,
} from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';
import { landingCopy } from './landing-copy';

/*
  block-parts P3 registry gate (DESIGN §2.10): for EVERY block the playground
  registers, every prop — recursing into array items and object keys exactly
  as the Inspector's RepeaterField / ObjectField / LinkField rows do — resolves
  to a real editor. Nothing may fall to the read-only path (which is a human
  summary now, but still not an editor) unless it is listed below with the
  reason it has no editor.
*/

/** `block.prop.path` (`*` for an array item) → why a read-only summary is right there. */
const READONLY_ALLOWED: Readonly<Record<string, string>> = {
  // (empty: every registered prop has an editor. Add an entry ONLY with a reason.)
};

type Path = readonly (string | number)[];

interface Finding {
  readonly where: string;
  readonly type: string;
}

function schemaType(schema: z.ZodType): string {
  return (unwrapSchema(schema)._zod.def as { type: string }).type;
}

function walk(
  kernel: BuilderKernel,
  blockType: string,
  parts: BlockParts,
  schema: z.ZodType,
  declaredKind: BlockPropertyKind | undefined,
  path: Path,
  out: Finding[],
): void {
  const resolved = resolveField(kernel.context.registry, schema, declaredKind, {
    parts,
    propPath: path,
  });
  const where = `${blockType}.${path.map((segment) => (typeof segment === 'number' ? '*' : segment)).join('.')}`;
  if (resolved.kind === 'readonly') {
    out.push({ where, type: schemaType(schema) });
    return;
  }
  if (resolved.kind === 'contributed') return; // the contribution owns the whole value
  switch (resolved.control) {
    case 'repeater': {
      const info = repeaterSchemaInfo(schema);
      if (info === undefined) {
        out.push({ where, type: 'array without element' });
        return;
      }
      const itemShape = propsShapeOf(unwrapSchema(info.element));
      const keys = Object.keys(itemShape);
      if (keys.length > 0 && schemaType(info.element) === 'object') {
        for (const [key, child] of Object.entries(itemShape)) {
          walk(kernel, blockType, parts, child, undefined, [...path, 0, key], out);
        }
      } else {
        walk(kernel, blockType, parts, info.element, undefined, [...path, 0], out);
      }
      return;
    }
    case 'object':
    case 'link': {
      // ObjectField renders every key; LinkField renders its label/href itself
      // and every OTHER key through the same rows — walking every key covers both.
      if (schemaType(schema) !== 'object') return;
      for (const [key, child] of Object.entries(propsShapeOf(unwrapSchema(schema)))) {
        const sub = resolveField(kernel.context.registry, child, undefined, {
          parts,
          propPath: [...path, key],
        });
        if (
          resolved.control === 'link' &&
          sub.kind !== 'readonly' &&
          schemaType(child) === 'string'
        ) {
          continue; // the link's own label/href inputs
        }
        walk(kernel, blockType, parts, child, undefined, [...path, key], out);
      }
      return;
    }
    default:
      return;
  }
}

function findings(kernel: BuilderKernel): { readonly blocks: number; readonly found: Finding[] } {
  const found: Finding[] = [];
  const blocks = kernel.context.registry.blocks();
  for (const block of blocks) {
    const schema: BlockSchema = block.schema;
    const parts = blockPartsOf(schema);
    const groups = (schema.propertyGroups ?? {}) as Readonly<
      Record<string, BlockPropertyGroup | undefined>
    >;
    for (const [key, propSchema] of Object.entries(propsShapeOf(schema.props))) {
      walk(kernel, schema.type, parts, propSchema, groups[key]?.kind, [key], found);
    }
  }
  return { blocks: blocks.length, found };
}

beforeAll(() => {
  // ProseMirror measures selection geometry jsdom does not implement.
  Range.prototype.getClientRects = function getClientRectsStub() {
    return [] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
    return new DOMRect(0, 0, 0, 0);
  };
});

afterEach(cleanup);

describe('field kinds — every registered prop has an editor (block-parts P3)', () => {
  it('no prop of any playground block resolves to the read-only path', () => {
    // The inline fixture registers everything the others do, plus the demo blocks.
    const kernel = createPlaygroundKernel({ fixture: 'inline' });
    const { blocks, found } = findings(kernel);
    // The walk must be real: an empty registry would pass vacuously.
    expect(blocks).toBeGreaterThan(50);
    const unexpected = found.filter((finding) => !Object.hasOwn(READONLY_ALLOWED, finding.where));
    expect(unexpected.map((finding) => `${finding.where} (${finding.type})`)).toEqual([]);
  });

  it('every allow-list entry still names a read-only prop (no stale exemptions)', () => {
    const kernel = createPlaygroundKernel({ fixture: 'inline' });
    const { found } = findings(kernel);
    const live = new Set(found.map((finding) => finding.where));
    expect(Object.keys(READONLY_ALLOWED).filter((where) => !live.has(where))).toEqual([]);
  });
});

describe('the rich-text row through the real extension (owner screenshot, 2026-10-06)', () => {
  it('shows the words in the editor skeleton while loading, then the WYSIWYG editor — never JSON', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing', dir: 'rtl' });
    kernel.setSelection(['rich-story']);
    render(createElement(Inspector, { kernel }));

    // The interim state that used to be `{"type":"doc",…}` in a one-line box.
    const json = [...document.querySelectorAll('input, textarea')].filter((element) =>
      (element as HTMLInputElement).value.includes('"type"'),
    );
    expect(json).toEqual([]);

    expect(
      await screen.findByRole('button', { name: 'Bold' }, { timeout: 8000 }),
    ).toBeInTheDocument();
    const surface = document.querySelector('.bldr-richtext-field__surface');
    expect(surface).not.toBeNull();
    // The rtl landing reads its words in Arabic since c4fee26 (landing-copy.ts).
    expect(surface?.textContent).toContain(landingCopy('rtl').story.heading);
    for (const block of surface?.querySelectorAll('p, h2, h3, h4') ?? []) {
      expect(block).toHaveAttribute('dir', 'auto');
    }
  });
});

// ── block-parts (2026-10-06) ──
/** Every input, textarea and contenteditable in the Inspector whose value reads as JSON. */
function jsonRows(): readonly string[] {
  const values = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map(
    (element) => element.value,
  );
  return values.filter((value) => /^\s*[[{]/u.test(value) && /"[a-zA-Z]+"\s*:/u.test(value));
}

describe('no Inspector row shows raw JSON for a composed region (fix pass, shot 19b)', () => {
  it.each(['content', 'design', 'advanced'])('customCode — the %s tab', async (tabName) => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    kernel.dispatch('insertNode', {
      type: 'customCode',
      parentId: 'root',
      props: {
        label: 'Region',
        tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Hello' }] },
      },
    });
    const id = Object.values(kernel.getDocument().nodes).find((node) => node.type === 'customCode')?.id;
    expect(id).toBeDefined();
    kernel.setSelection([id ?? '']);
    const user = userEvent.setup();
    render(createElement(Inspector, { kernel }));
    const tab = screen.queryByRole('tab', { name: new RegExp(tabName, 'iu') });
    if (tab !== null) await user.click(tab);
    if (tabName === 'content') {
      // The contributed tree field has loaded: its summary and the advanced toggle, no textarea.
      expect(await screen.findByRole('button', { name: 'Edit source (advanced)' }, { timeout: 8000 })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Composition tree' })).toBeNull();
    }
    expect(jsonRows()).toEqual([]);
  });
});
// ── /block-parts ──
