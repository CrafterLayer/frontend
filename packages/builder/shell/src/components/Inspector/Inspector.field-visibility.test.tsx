import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type FieldProps,
  type FieldTypeDef,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { fieldSiblingsOf, isFieldRowHidden } from '../../fields/field-visibility';
import { resolveField } from '../../fields/resolve-field';
import { Inspector } from './Inspector';

/*
  FieldTypeDef.hidden / .siblings (jsParams, 2026-10-12): a field type may
  leave its prop out of the Inspector — always (data another surface writes)
  or per value (controls with nothing to control yet) — and may ask for the
  props beside its own. Both are found by DECLARATION: the markers below are
  meta on the schema, the prop names are deliberately unremarkable.
*/

const MARK = 'test-field-kind';

function markerOf(schema: z.ZodType): unknown {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[MARK] !== undefined) return meta[MARK];
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    if (def.type !== 'optional' || def.innerType === undefined) return undefined;
    current = def.innerType;
  }
}

const studioData = () =>
  z
    .object({ spec: z.array(z.string()) })
    .meta({ [MARK]: 'data' })
    .optional();
const tunedValues = () =>
  z
    .record(z.string(), z.number())
    .meta({ [MARK]: 'tuned' })
    .optional();

const NullRender: BlockRenderComponent = () => null;

/** What the contributed field received, shown so a test can read it. */
function TunedField({ value, siblings, locale, onChange }: FieldProps) {
  const data = siblings?.find((sibling) => markerOf(sibling.schema) === 'data')?.value;
  return (
    <div>
      <output data-testid="tuned">{JSON.stringify({ value, data, locale })}</output>
      <button
        type="button"
        onClick={() => {
          onChange({ ...(value as Record<string, number> | undefined), n: 1 });
        }}
      >
        Tune
      </button>
    </div>
  );
}

const nothingToTune = ({
  value,
  siblings,
}: Parameters<Exclude<FieldTypeDef['hidden'], boolean | undefined>>[0]) => {
  const data = siblings.find((sibling) => markerOf(sibling.schema) === 'data')?.value as
    { spec?: string[] } | undefined;
  return (
    (data?.spec ?? []).length === 0 && Object.keys((value as object | undefined) ?? {}).length === 0
  );
};

function fieldTypes(hidden: FieldTypeDef['hidden'] = nothingToTune): FieldTypeDef[] {
  return [
    {
      id: 'test.data',
      match: (schema) => (markerOf(schema) === 'data' ? 100 : 0),
      hidden: true,
      load: () => Promise.reject(new Error('No component: written elsewhere.')),
    },
    {
      id: 'test.tuned',
      match: (schema) => (markerOf(schema) === 'tuned' ? 100 : 0),
      siblings: true,
      hidden,
      load: () => Promise.resolve({ default: TunedField }),
    },
  ];
}

function manifest(hidden?: FieldTypeDef['hidden']): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'field-visibility',
    version: '1.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'Page',
            props: z.object({}),
            slots: { default: { allow: ['scene'] } },
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'scene',
            description: 'Scene',
            props: z.object({
              title: z.string().max(40).default('Scene'),
              data: studioData(),
              values: tunedValues(),
            }),
            propertyGroups: {
              title: { tab: 'content', section: 'Identity' },
              data: { tab: 'content', section: 'Tuning' },
              values: { tab: 'content', section: 'Tuning' },
            },
            examples: [],
          }),
          render: NullRender,
        },
      ],
      fieldTypes: fieldTypes(hidden),
    },
  };
}

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1'] } },
    s1: { id: 's1', type: 'scene', props: { title: 'Stars' } },
  },
};

function makeKernel(hidden?: FieldTypeDef['hidden']) {
  const kernel = createBuilder({
    document: DOC,
    extensions: [manifest(hidden)],
    ports: { clock: fixedClock(), ids: seededIds('vis') },
  });
  kernel.setSelection(['s1']);
  return kernel;
}

function tuned(): unknown {
  return JSON.parse(screen.getByTestId('tuned').textContent);
}

describe('FieldTypeDef.hidden — props the Inspector leaves out', () => {
  it('resolves a hidden prop to its contribution (so it is never a read-only row) and shows no row', () => {
    const kernel = makeKernel();
    const schema = studioData();
    expect(resolveField(kernel.context.registry, schema).kind).toBe('contributed');
    render(<Inspector kernel={kernel} />);
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Stars');
    expect(screen.queryByText('Data')).toBeNull();
  });

  it('leaves out a row with nothing to show — and its section — until a write gives it one', async () => {
    const kernel = makeKernel();
    render(<Inspector kernel={kernel} />);
    expect(screen.queryByRole('heading', { name: 'Tuning' })).toBeNull();

    act(() => {
      kernel.dispatch('setProp', { id: 's1', key: 'data', value: { spec: ['speed'] } });
    });
    expect(screen.getByRole('heading', { name: 'Tuning' })).toBeInTheDocument();
    expect(await screen.findByTestId('tuned')).toBeInTheDocument();

    act(() => {
      kernel.undo();
    });
    expect(screen.queryByRole('heading', { name: 'Tuning' })).toBeNull();
  });

  it('keeps the row when the rule throws: a broken contribution never takes a control away', async () => {
    const kernel = makeKernel(() => {
      throw new Error('broken rule');
    });
    render(<Inspector kernel={kernel} />);
    expect(await screen.findByTestId('tuned')).toBeInTheDocument();
    // `true` is still absolute.
    expect(screen.queryByText('Data')).toBeNull();
  });
});

describe('FieldTypeDef.siblings — the props beside a row', () => {
  it('hands the field its siblings by schema and value, and the editor language', async () => {
    const kernel = makeKernel(false);
    kernel.dispatch('setProp', { id: 's1', key: 'data', value: { spec: ['speed'] } });
    render(<Inspector kernel={kernel} locale="ar" />);
    await screen.findByTestId('tuned');
    expect(tuned()).toEqual({ data: { spec: ['speed'] }, locale: 'ar' });
  });

  it('re-renders the field when a sibling changes, and commits through the same door', async () => {
    const user = userEvent.setup();
    const kernel = makeKernel(false);
    render(<Inspector kernel={kernel} />);
    await screen.findByTestId('tuned');
    act(() => {
      kernel.dispatch('setProp', { id: 's1', key: 'data', value: { spec: ['glow'] } });
    });
    expect(tuned()).toMatchObject({ data: { spec: ['glow'] } });

    const before = kernel.transactions().length;
    await user.click(screen.getByRole('button', { name: 'Tune' }));
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(kernel.getDocument().nodes['s1']?.props['values']).toEqual({ n: 1 });
    expect(tuned()).toMatchObject({ value: { n: 1 } });
  });
});

describe('field-visibility helpers', () => {
  it('lists every other prop with its schema and stored value, in declaration order', () => {
    const shape = { a: z.string(), b: z.number(), c: z.boolean() };
    expect(
      fieldSiblingsOf(shape, { a: 'x', c: true }, 'b').map(({ key, value }) => [key, value]),
    ).toEqual([
      ['a', 'x'],
      ['c', true],
    ]);
    expect(fieldSiblingsOf(shape, undefined, 'a')[0]?.schema).toBe(shape.b);
  });

  it('reads a rule lazily and contains a throw', () => {
    let built = 0;
    const row = () => {
      built += 1;
      return { value: undefined, siblings: [] };
    };
    expect(isFieldRowHidden(undefined, row)).toBe(false);
    expect(isFieldRowHidden(true, row)).toBe(true);
    expect(isFieldRowHidden(false, row)).toBe(false);
    expect(built).toBe(0);
    expect(isFieldRowHidden(() => true, row)).toBe(true);
    expect(
      isFieldRowHidden(() => {
        throw new Error('no');
      }, row),
    ).toBe(false);
    expect(built).toBe(2);
  });
});
