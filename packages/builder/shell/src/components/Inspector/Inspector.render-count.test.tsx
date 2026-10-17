/*
  Inspector render-count contract.

  The panel's render model, pinned: one property edit reaches ONE row body and
  nothing else; the shell's four primitive selectors never render on a value
  write; tab bodies mount once; a section toggle touches that section only.

  BASELINE — measured 2026-09-02 against the monolithic Inspector.tsx +
  InspectorRow.tsx tree, before the split (seam-independent proxies: the row
  counter wrapped './InspectorRow', the controls wrapped '../../fields/controls',
  plus '../../fields/resolve-field' and safeParse spies on all 20 shape schemas;
  "rows" = row-component executions, "commits" = Profiler commits):

    mount ........................ rows 20 (every tab), resolveField 20, safeParse 32
    click Design ................. rows 20, safeParse 32
    external setProp gap ......... rows 21 (gap 2), safeParse 31
    typing one char (heading) .... rows 21 (heading 2)
    segment click ................ rows 24 (heading 3, align 3), commits 3
    tab round trip ............... rows 41
    collapse Layout .............. rows 20
    host rerender, same props .... rows 20
    new-but-equal theme .......... rows 20
    unrelated node edit .......... rows 0, safeParse 1 (the kernel's own)
    same-id setSelection ......... rows 0
    no-op setProp ................ rows 0, safeParse 1 (the kernel's own)
    dir flip (setDocMeta) ........ rows 0 (alignment icons went stale)
    selection change → s2 ........ rows 20, resolveField 20
    registry epoch ............... rows 20, resolveField 20
    removeNode of selected ....... rows 0, commits 1
    undo of the gap edit ......... rows 21 (gap 2), safeParse 32

  TARGET (the pins below): mount 9/9 — Content only; an edit is 1 body; the
  header, the sections and the live region are 0 on an edit; a tab round trip
  is 0; a collapse is 1 section; a host rerender with identical props is header
  1 and rows 0; a new-but-equal theme is every mounted row once (the memo
  boundary, documented); unrelated / same-id / no-op writes are 0 commits.
*/
import { Profiler, type ComponentProps } from 'react';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type * as ResolveFieldModule from '../../fields/resolve-field';
import { Inspector } from './Inspector';
import type * as HeaderModule from './InspectorHeader';
import type * as LiveRegionModule from './InspectorLiveRegion';
import type * as RowBodyModule from './InspectorRowBody';
import type * as SectionModule from './InspectorSection';
import { effectiveValue } from './schema-facts';

const counters = vi.hoisted(() => ({
  bodies: new Map<string, number>(),
  sections: new Map<string, number>(),
  header: 0,
  liveRegion: 0,
  resolveField: 0,
}));

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

// The measurement seams. Each wrapper is a plain function calling the real
// component, so hooks run in the wrapper's frame and counts are executions of
// the real body. InspectorRowBody is a plain function by contract (the memo is
// InspectorPropertyRow, which imports this mocked module).
vi.mock('./InspectorRowBody', async (importOriginal) => {
  const actual = await importOriginal<typeof RowBodyModule>();
  return {
    ...actual,
    InspectorRowBody: (props: Parameters<typeof actual.InspectorRowBody>[0]) => {
      bump(counters.bodies, props.propKey);
      return actual.InspectorRowBody(props);
    },
  };
});

vi.mock('./InspectorHeader', async (importOriginal) => {
  const actual = await importOriginal<typeof HeaderModule>();
  return {
    ...actual,
    InspectorHeader: (props: Parameters<typeof actual.InspectorHeader>[0]) => {
      counters.header += 1;
      return actual.InspectorHeader(props);
    },
  };
});

vi.mock('./InspectorLiveRegion', async (importOriginal) => {
  const actual = await importOriginal<typeof LiveRegionModule>();
  return {
    ...actual,
    InspectorLiveRegion: (props: Parameters<typeof actual.InspectorLiveRegion>[0]) => {
      counters.liveRegion += 1;
      return actual.InspectorLiveRegion(props);
    },
  };
});

vi.mock('./InspectorSection', async (importOriginal) => {
  const actual = await importOriginal<typeof SectionModule>();
  const { memo } = await import('react');
  const Inner = actual.InspectorSection.type;
  return {
    ...actual,
    // Keep the memo boundary; count SECTION BODY executions behind it.
    InspectorSection: memo((props: ComponentProps<typeof actual.InspectorSection>) => {
      bump(counters.sections, props.section.name);
      return Inner(props);
    }),
  };
});

vi.mock('../../fields/resolve-field', async (importOriginal) => {
  const actual = await importOriginal<typeof ResolveFieldModule>();
  return {
    ...actual,
    resolveField: (...args: Parameters<typeof actual.resolveField>) => {
      counters.resolveField += 1;
      return actual.resolveField(...args);
    },
  };
});

const SCHEMA = z.object({
  eyebrow: z.string().default('Eyebrow'),
  heading: z.string().default('Heading'),
  body: z.string().default('Body copy'),
  email: z.string().default('hello@example.com'),
  phone: z.string().default(''),
  showForm: z.boolean().default(true),
  formTitle: z.string().default('Get in touch'),
  nameLabel: z.string().default('Name'),
  submitLabel: z.string().default('Send'),
  variant: z.enum(['split', 'stacked']).default('split'),
  align: z.enum(['start', 'center', 'end']).default('start'),
  tone: z.enum(['light', 'dark']).default('light'),
  background: z.enum(['surface', 'accent']).default('surface'),
  spacing: z.enum(['compact', 'comfortable']).default('comfortable'),
  gap: z.number().default(16),
  paddingTop: z.number().default(24),
  width: z.number().default(1152),
  formAction: z.string().default('/contact'),
  method: z.enum(['post', 'get']).default('post'),
  anchorId: z.string().default(''),
});

const KEYS = Object.keys(SCHEMA.shape);
const CONTENT_KEYS = [
  'eyebrow',
  'heading',
  'body',
  'email',
  'phone',
  'showForm',
  'formTitle',
  'nameLabel',
  'submitLabel',
];
const DESIGN_KEYS = [
  'variant',
  'align',
  'tone',
  'background',
  'spacing',
  'gap',
  'paddingTop',
  'width',
];
const STORED_KEYS = ['heading', 'showForm', 'align', 'anchorId'];

const NullRender: BlockRenderComponent = () => null;
const SlotRender = ((props: { slots: Record<string, unknown> }) => (
  <div>{Object.values(props.slots) as React.ReactNode[]}</div>
)) as BlockRenderComponent;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'render-count-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['section'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'section',
          description: 'Section',
          props: SCHEMA,
          propertyGroups: {
            eyebrow: { tab: 'content', section: 'Introduction' },
            heading: { tab: 'content', section: 'Introduction' },
            body: { tab: 'content', section: 'Introduction' },
            email: { tab: 'content', section: 'Contact details' },
            phone: { tab: 'content', section: 'Contact details' },
            showForm: { tab: 'content', section: 'Form' },
            formTitle: { tab: 'content', section: 'Form' },
            nameLabel: { tab: 'content', section: 'Form labels' },
            submitLabel: { tab: 'content', section: 'Form labels' },
            variant: { tab: 'design', section: 'Layout' },
            align: { tab: 'design', section: 'Alignment' },
            tone: { tab: 'design', section: 'Colour' },
            background: { tab: 'design', section: 'Colour', kind: 'color-role' },
            spacing: { tab: 'design', section: 'Spacing' },
            gap: { tab: 'design', section: 'Spacing' },
            paddingTop: { tab: 'design', section: 'Spacing' },
            width: { tab: 'design', section: 'Width' },
            formAction: { tab: 'advanced', section: 'Form submission' },
            method: { tab: 'advanced', section: 'Form submission' },
            anchorId: { tab: 'advanced', section: 'Identity' },
          },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1', 's2'] } },
    // Four stored, sixteen unset: the unset rows are the ones whose defaults
    // the old tree re-parsed on every render.
    s1: {
      id: 's1',
      type: 'section',
      props: { heading: 'Talk to us', showForm: true, align: 'center', anchorId: 'contact' },
    },
    s2: {
      id: 's2',
      type: 'section',
      props: { heading: 'Second', showForm: false, align: 'end', anchorId: 'second' },
    },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('probe') },
  });

let commits = 0;
const spies = new Map<string, MockInstance>();

function reset(): void {
  counters.bodies.clear();
  counters.sections.clear();
  counters.header = 0;
  counters.liveRegion = 0;
  counters.resolveField = 0;
  commits = 0;
  for (const spy of spies.values()) {
    spy.mockClear();
  }
}

function safeParseTotal(): number {
  let total = 0;
  for (const spy of spies.values()) {
    total += spy.mock.calls.length;
  }
  return total;
}

function nonZero(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...map].filter(([, count]) => count > 0));
}

const once = (keys: readonly string[]): Record<string, number> =>
  Object.fromEntries(keys.map((key) => [key, 1]));

const onRender = () => {
  commits += 1;
};

function mount(kernel: BuilderKernel, props: Partial<Parameters<typeof Inspector>[0]> = {}) {
  return render(
    <Profiler id="inspector" onRender={onRender}>
      <Inspector kernel={kernel} {...props} />
    </Profiler>,
  );
}

beforeEach(() => {
  spies.clear();
  for (const [key, schema] of Object.entries(SCHEMA.shape)) {
    spies.set(key, vi.spyOn(schema as z.ZodType, 'safeParse'));
  }
  reset();
});

describe('Inspector render counts', () => {
  it('fixture: 20 properties over three tabs, four stored', () => {
    expect(KEYS).toHaveLength(20);
    expect(CONTENT_KEYS).toHaveLength(9);
    expect(DESIGN_KEYS).toHaveLength(8);
    expect(Object.keys(DOC.nodes['s1']?.props ?? {})).toEqual(STORED_KEYS);
  });

  it('mounts the Content tab only, resolves each of its rows once and parses each unset default at most once', () => {
    const kernel = makeKernel();
    kernel.setSelection(['s1']);
    mount(kernel);

    expect(nonZero(counters.bodies)).toEqual(once(CONTENT_KEYS));
    expect(counters.resolveField).toBe(9);
    for (const key of KEYS) {
      const parses = spies.get(key)?.mock.calls.length ?? 0;
      if (STORED_KEYS.includes(key) || !CONTENT_KEYS.includes(key)) {
        expect(parses, key).toBe(0);
      } else {
        expect(parses, key).toBeLessThanOrEqual(1);
      }
    }
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);
  });

  it('edits, tabs, sections and host rerenders each render exactly what they touch', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['s1']);
    const user = userEvent.setup();
    const view = mount(kernel);

    // Design mounts on first activation: its 8 rows, resolved once each; Content bails.
    reset();
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(nonZero(counters.bodies)).toEqual(once(DESIGN_KEYS));
    expect(counters.resolveField).toBe(8);

    // An external edit reaches ONE row body and nothing else.
    reset();
    act(() => {
      kernel.dispatch('setProp', { id: 's1', key: 'gap', value: 20 }, 'user');
    });
    expect(nonZero(counters.bodies)).toEqual({ gap: 1 });
    expect(counters.header).toBe(0);
    expect(nonZero(counters.sections)).toEqual({});
    expect(counters.liveRegion).toBe(0);
    expect(safeParseTotal()).toBeLessThanOrEqual(1); // the kernel's own validation of `gap`

    // Typing one character: the edited row once, the live region once.
    await user.click(screen.getByRole('tab', { name: 'Content' }));
    const heading = screen.getByRole('textbox', { name: 'heading' });
    await user.click(heading);
    reset();
    await user.type(heading, '!');
    expect(nonZero(counters.bodies)).toEqual({ heading: 1 });
    expect(counters.header).toBe(0);
    expect(counters.liveRegion).toBe(1);

    // A segment click with another row focused: the segment's row once; the
    // blurred row at most once (its R8 lock lets go); nothing else.
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    heading.focus();
    reset();
    await user.click(screen.getByRole('button', { name: 'End alignment' }));
    expect(counters.bodies.get('align')).toBe(1);
    expect(counters.bodies.get('heading') ?? 0).toBeLessThanOrEqual(1);
    for (const key of KEYS) {
      if (key !== 'align' && key !== 'heading') {
        expect(counters.bodies.get(key) ?? 0, key).toBe(0);
      }
    }
    expect(counters.header).toBe(0);

    // A tab round trip mounts nothing and resolves nothing.
    reset();
    await user.click(screen.getByRole('tab', { name: 'Content' }));
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(nonZero(counters.bodies)).toEqual({});
    expect(counters.resolveField).toBe(0);

    // Collapsing a section renders that section and no row.
    reset();
    await user.click(screen.getByRole('button', { name: 'Layout' }));
    expect(nonZero(counters.sections)).toEqual({ Layout: 1 });
    expect(nonZero(counters.bodies)).toEqual({});

    // A host rerender with identical props: the header, no section, no row.
    reset();
    view.rerender(
      <Profiler id="inspector" onRender={onRender}>
        <Inspector kernel={kernel} />
      </Profiler>,
    );
    expect(counters.header).toBe(1);
    expect(nonZero(counters.sections)).toEqual({});
    expect(nonZero(counters.bodies)).toEqual({});

    // A new-but-equal theme is a new palette, and the palette is part of every
    // row's scope: every MOUNTED row once. This documents the memo boundary.
    reset();
    view.rerender(
      <Profiler id="inspector" onRender={onRender}>
        <Inspector kernel={kernel} theme={{ ...lightTheme }} />
      </Profiler>,
    );
    expect(nonZero(counters.bodies)).toEqual(once([...CONTENT_KEYS, ...DESIGN_KEYS]));

    // Nothing the panel shows changed: zero commits.
    reset();
    act(() => {
      kernel.dispatch('setProp', { id: 's2', key: 'gap', value: 20 }, 'user');
    });
    expect(commits).toBe(0);
    expect(nonZero(counters.bodies)).toEqual({});

    reset();
    act(() => {
      kernel.setSelection(['s1']);
    });
    expect(commits).toBe(0);
    expect(nonZero(counters.bodies)).toEqual({});

    reset();
    act(() => {
      kernel.dispatch('setProp', { id: 's1', key: 'gap', value: 20 }, 'user');
    });
    expect(commits).toBe(0);
    expect(nonZero(counters.bodies)).toEqual({});

    // Direction flows from the shell: every mounted row once (icons mirror).
    reset();
    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' }, 'user');
    });
    expect(nonZero(counters.bodies)).toEqual(once([...CONTENT_KEYS, ...DESIGN_KEYS]));

    // A selection change: header once, Content remounts (9 bodies, 9 resolves).
    reset();
    act(() => {
      kernel.setSelection(['s2']);
    });
    expect(counters.header).toBe(1);
    expect(nonZero(counters.bodies)).toEqual(once(CONTENT_KEYS));
    expect(counters.resolveField).toBe(9);

    // A registry epoch re-resolves every mounted row once.
    reset();
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'no-match-fields',
        version: '1.0.0',
        contributes: {
          fieldTypes: [
            { id: 'never', match: () => 0, load: () => Promise.reject(new Error('unused')) },
          ],
        },
      });
    });
    expect(nonZero(counters.bodies)).toEqual(once(CONTENT_KEYS));
    expect(counters.resolveField).toBe(9);

    // Removing the selected node prunes the selection in the same write.
    reset();
    expect(() => {
      act(() => {
        kernel.dispatch('removeNode', { id: 's2' }, 'user');
      });
    }).not.toThrow();
    expect(screen.getByText('Select a block to edit its properties.')).toBeInTheDocument();
  });

  it('undo after an external edit reaches the edited row only', () => {
    const kernel = makeKernel();
    kernel.setSelection(['s1']);
    mount(kernel);
    act(() => {
      kernel.dispatch('setProp', { id: 's1', key: 'heading', value: 'Changed' }, 'user');
    });
    reset();
    act(() => {
      kernel.undo();
    });
    expect(nonZero(counters.bodies)).toEqual({ heading: 1 });
    expect(counters.header).toBe(0);
    expect(screen.getByRole('textbox', { name: 'heading' })).toHaveValue('Talk to us');
  });

  it('hands every row the same schema default reference', () => {
    const items = z.array(z.string()).default([]);
    expect(effectiveValue(undefined, items)).toBe(effectiveValue(undefined, items));
  });
});
