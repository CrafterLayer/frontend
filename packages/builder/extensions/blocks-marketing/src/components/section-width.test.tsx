import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ComponentType } from 'react';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { BlockRenderComponent, BlockSchema } from '@craftkit/builder-schema';

import { blocksMarketing } from '../index';
import { WIDTH_CLASSES } from './section-classes';
import { sectionWidths } from './section-options';

/**
 * blocks-polish (2026-10-08): one content width per `width` value, for every
 * section.
 *
 * The templates audit measured left edges zig-zagging down a page at 1440:
 * testimonials and features ran edge to edge, FAQ sat narrower, prose had an
 * axis of its own. Every block already HAD the shared column; what differed
 * was its default and, for prose, a hard-coded narrow column. So the law has
 * two halves: each block's column is the shared `sectionContentClasses`
 * column for the width it is given, and a section that says nothing gets the
 * same width as every other section.
 */

interface Entry {
  readonly schema: BlockSchema;
  readonly render: BlockRenderComponent;
}

const entries = (blocksMarketing.contributes?.blocks ?? []) as readonly Entry[];

/* Layout primitives and a bare image choose their own measure; everything else is a page section. */
const OWN_DEFAULT = new Set(['grid', 'stack', 'image']);

function widthEnum(schema: BlockSchema): readonly string[] | undefined {
  const shape = (schema.props as unknown as { shape?: Record<string, z.ZodType> }).shape;
  const width = shape?.['width'];
  if (width === undefined) return undefined;
  const inner = width instanceof z.ZodDefault ? width.unwrap() : width;
  return inner instanceof z.ZodEnum ? (inner.options as readonly string[]) : undefined;
}

const sections = entries.filter((entry) => {
  const options = widthEnum(entry.schema);
  return options !== undefined && sectionWidths.every((width) => options.includes(width));
});

function exampleProps(schema: BlockSchema): Record<string, unknown> {
  const example = schema.examples[0]?.node as { props?: Record<string, unknown> } | undefined;
  return example?.props ?? {};
}

/* The shared column: `sectionContentClasses` is the only place `mx-auto w-full min-w-0` is spelled. */
function columns(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.mx-auto.w-full.min-w-0')];
}

describe('one content width per width value', () => {
  it('finds the section blocks it claims to check', () => {
    expect(sections.length).toBeGreaterThan(20);
  });

  it.each(sections.map((entry) => [entry.schema.type, entry] as const))(
    '%s defaults to the shared wide column unless it is a layout primitive',
    (type, entry) => {
      const parsed = entry.schema.props.parse(exampleProps(entry.schema)) as { width?: string };
      const defaults = entry.schema.props.parse({ ...exampleProps(entry.schema), width: undefined }) as {
        width?: string;
      };
      expect(parsed.width).toBeDefined();
      expect(defaults.width).toBe(OWN_DEFAULT.has(type) ? 'standard' : 'wide');
    },
  );

  it.each(
    sections
      .filter((entry) => !OWN_DEFAULT.has(entry.schema.type))
      .flatMap((entry) => sectionWidths.map((width) => [entry.schema.type, width, entry] as const)),
  )('%s at width %s renders the shared column for that width', (type, width, entry) => {
    const props = entry.schema.props.parse({ ...exampleProps(entry.schema), width });
    const Component = entry.render as unknown as ComponentType<Record<string, unknown>>;
    const { container } = render(
      <Component
        node={{ id: `w-${type}`, type, props: {} }}
        props={props}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    const found = columns(container);
    expect(found.length, `${type} renders no shared column`).toBeGreaterThan(0);
    expect(found[0]).toHaveClass(WIDTH_CLASSES[width]);
    /* No second column with a different width competing with it. */
    for (const column of found) {
      for (const other of sectionWidths) {
        if (other !== width) expect(column).not.toHaveClass(WIDTH_CLASSES[other]);
      }
    }
  });

  it('puts prose on the shared wide column and keeps its reading measure inside', () => {
    const source = readFileSync(join(import.meta.dirname, 'RichTextBlock/RichTextBlock.tsx'), 'utf8');
    expect(source).toContain("sectionContentClasses('wide'");
    expect(source).not.toContain("sectionContentClasses('narrow'");
    expect(source).toContain("className: 'max-w-content-narrow'");
  });
});
