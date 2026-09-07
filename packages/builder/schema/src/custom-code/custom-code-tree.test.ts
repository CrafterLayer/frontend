import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CUSTOM_CODE_MAX_DEPTH,
  CUSTOM_CODE_MAX_NODES,
  customCodeClassNames,
  customCodeComponentTypes,
  customCodeIconNames,
  customCodeTree,
  customCodeTreeSchema,
  emptyCustomCodeTree,
  isCustomCodeTag,
  isCustomCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';

function nest(depth: number): CustomCodeNode {
  let node: CustomCodeNode = { kind: 'element', tag: 'span', text: 'leaf' };
  for (let at = 0; at < depth; at += 1) {
    node = { kind: 'element', tag: 'div', children: [node] };
  }
  return node;
}

describe('custom-code tree', () => {
  it('accepts a tree that mixes authored markup with a component reference', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'min-h-screen bg-surface',
          children: [
            { kind: 'element', tag: 'h1', text: 'Reem Haddad' },
            { kind: 'component', component: 'card', props: { tone: 'muted' }, children: [] },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('has no vocabulary for a script tag, so injection is unrepresentable', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'script', text: 'alert(1)' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an event-handler attribute rather than dropping it silently', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', attributes: { onclick: 'steal()' } as never }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown property on a node — the door is strict on write', () => {
    const result = customCodeTreeSchema.safeParse({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', dangerouslySetInnerHTML: '<script/>' }],
    });

    expect(result.success).toBe(false);
  });

  it('accepts a tree at the depth ceiling and refuses one past it', () => {
    const atLimit = { kind: 'root', children: [nest(CUSTOM_CODE_MAX_DEPTH - 2)] };
    const beyond = { kind: 'root', children: [nest(CUSTOM_CODE_MAX_DEPTH + 5)] };

    expect(customCodeTreeSchema.safeParse(atLimit).success).toBe(true);
    expect(customCodeTreeSchema.safeParse(beyond).success).toBe(false);
  });

  it('refuses a flat tree past the node ceiling — depth alone does not bound size', () => {
    const flat = {
      kind: 'root',
      children: Array.from({ length: CUSTOM_CODE_MAX_NODES + 10 }, () => ({
        kind: 'element' as const,
        tag: 'span' as const,
        text: 'x',
      })),
    };

    const result = customCodeTreeSchema.safeParse(flat);

    expect(result.success).toBe(false);
  });

  it('survives the depth guard without recursing on a hostile tree', () => {
    // The guard must be iterative: a recursive one would overflow before zod ran.
    expect(() =>
      customCodeTreeSchema.safeParse({ kind: 'root', children: [nest(50_000)] }),
    ).not.toThrow();
  });

  it('is JSON-Schema representable, which is what lets a block declare it', () => {
    expect(() => z.toJSONSchema(z.object({ tree: customCodeTreeSchema }))).not.toThrow();
  });

  it('is recognised through optional and default wrappers by meta, not identity', () => {
    expect(isCustomCodeTreeSchema(customCodeTree())).toBe(true);
    expect(isCustomCodeTreeSchema(customCodeTree().optional())).toBe(true);
    expect(isCustomCodeTreeSchema(z.string())).toBe(false);
  });

  it('reports the canonical empty tree as valid', () => {
    expect(customCodeTreeSchema.safeParse(emptyCustomCodeTree()).success).toBe(true);
  });

  it('collects class names and component types for the doors that police them', () => {
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'p-8',
          children: [
            { kind: 'component', component: 'card' },
            { kind: 'element', tag: 'p', className: 'text-sm' },
            { kind: 'component', component: 'button' },
            { kind: 'component', component: 'card' },
          ],
        },
      ],
    };

    expect([...customCodeClassNames(tree)].sort()).toEqual(['p-8', 'text-sm']);
    expect(customCodeComponentTypes(tree)).toEqual(['button', 'card']);
  });

  it('walks tolerantly over malformed input, because the AI door inspects unvalidated proposals', () => {
    expect(customCodeClassNames(null)).toEqual([]);
    expect(customCodeComponentTypes({ children: 'not-an-array' })).toEqual([]);
  });

  describe('icon nodes', () => {
    const withIcon = (icon: Record<string, unknown>) =>
      customCodeTreeSchema.safeParse({ kind: 'root', children: [{ kind: 'icon', ...icon }] });

    it('accepts a Lucide name with optional size, stroke, class, and label', () => {
      expect(
        withIcon({
          name: 'arrow-right',
          size: 20,
          strokeWidth: 1.5,
          className: 'text-accent',
          label: 'Next',
        }).success,
      ).toBe(true);
      expect(withIcon({ name: 'mail' }).success).toBe(true);
      expect(withIcon({ name: 'arrow-down-0-1' }).success).toBe(true);
    });

    it('refuses anything that is not a kebab-case name — an SVG surface is never opened', () => {
      for (const name of ['Mail', 'arrow--right', 'mail ', '<svg>', 'a/b', '']) {
        expect(withIcon({ name }).success, name).toBe(false);
      }
    });

    it('is a leaf: children and text are unknown keys and refused', () => {
      expect(withIcon({ name: 'mail', children: [] }).success).toBe(false);
      expect(withIcon({ name: 'mail', text: 'x' }).success).toBe(false);
    });

    it('bounds size and stroke to what a 24-unit grid can draw', () => {
      expect(withIcon({ name: 'mail', size: 4 }).success).toBe(false);
      expect(withIcon({ name: 'mail', size: 512 }).success).toBe(false);
      expect(withIcon({ name: 'mail', strokeWidth: 9 }).success).toBe(false);
    });

    it('collects icon names for the door that checks they exist', () => {
      const tree = {
        kind: 'root',
        children: [
          { kind: 'element', tag: 'div', children: [{ kind: 'icon', name: 'mail' }] },
          { kind: 'icon', name: 'globe' },
          { kind: 'icon', name: 'mail' },
        ],
      };

      expect(customCodeIconNames(tree)).toEqual(['globe', 'mail']);
      expect(customCodeIconNames(null)).toEqual([]);
    });
  });

  it('answers tag membership for the renderer read guard', () => {
    expect(isCustomCodeTag('section')).toBe(true);
    expect(isCustomCodeTag('iframe')).toBe(false);
  });
});
