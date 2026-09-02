import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { InspectorPropertyRow } from './InspectorPropertyRow';
import type * as RowBodyModule from './InspectorRowBody';
import type { InspectorRowBodyProps, InspectorRowScope } from './types';

const bodies = vi.hoisted(() => ({
  renders: 0,
  last: undefined as InspectorRowBodyProps | undefined,
}));

vi.mock('./InspectorRowBody', async (importOriginal) => {
  const actual = await importOriginal<typeof RowBodyModule>();
  return {
    ...actual,
    InspectorRowBody: (props: Parameters<typeof actual.InspectorRowBody>[0]) => {
      bodies.renders += 1;
      bodies.last = props;
      return actual.InspectorRowBody(props);
    },
  };
});

const NullRender: BlockRenderComponent = () => null;
const SCHEMA = z.object({
  title: z.string().default('Hi'),
  count: z.number().default(3),
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'property-row-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['card'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'card',
          description: 'Card',
          props: SCHEMA,
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
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['c1'] } },
    c1: {
      id: 'c1',
      type: 'card',
      props: { title: 'Hello' },
      responsive: { tablet: { title: 'Tab' } },
    },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pr') },
  });

const scopeFor = (
  kernel: ReturnType<typeof makeKernel>,
  bucket: EditingBucket,
): InspectorRowScope => ({
  kernel,
  nodeId: 'c1',
  bucket,
  catalogVersion: 0,
  palette: [],
  onRetheme: undefined,
  announce: () => undefined,
  dir: 'ltr',
  declarations: undefined,
});

beforeEach(() => {
  bodies.renders = 0;
  bodies.last = undefined;
});

describe('InspectorPropertyRow', () => {
  it('hands the body document truth: stored value, effective default and override facts', () => {
    const kernel = makeKernel();
    const scope = scopeFor(kernel, 'base');
    const view = render(
      <InspectorPropertyRow scope={scope} propKey="title" schema={SCHEMA.shape.title} />,
    );
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    expect(bodies.last).toMatchObject({ value: 'Hello', baseValue: 'Hello', hasOverride: false });

    view.rerender(
      <InspectorPropertyRow scope={scope} propKey="count" schema={SCHEMA.shape.count} />,
    );
    expect(bodies.last).toMatchObject({ value: 3, baseValue: 3, hasOverride: false });

    view.rerender(
      <InspectorPropertyRow
        scope={scopeFor(kernel, 'tablet')}
        propKey="title"
        schema={SCHEMA.shape.title}
      />,
    );
    expect(bodies.last).toMatchObject({ value: 'Tab', baseValue: 'Hello', hasOverride: true });
    expect(screen.getByText('tablet override')).toBeInTheDocument();
  });

  it('bails on a parent render with the same scope and re-renders for its own property only', () => {
    const kernel = makeKernel();
    const scope = scopeFor(kernel, 'base');
    const view = render(
      <InspectorPropertyRow scope={scope} propKey="title" schema={SCHEMA.shape.title} />,
    );
    expect(bodies.renders).toBe(1);

    view.rerender(
      <InspectorPropertyRow scope={scope} propKey="title" schema={SCHEMA.shape.title} />,
    );
    expect(bodies.renders).toBe(1);

    act(() => {
      kernel.dispatch('setProp', { id: 'c1', key: 'count', value: 9 }, 'user');
    });
    expect(bodies.renders).toBe(1);

    act(() => {
      kernel.dispatch('setProp', { id: 'c1', key: 'title', value: 'Changed' }, 'user');
    });
    expect(bodies.renders).toBe(2);
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Changed');
  });

  it('clears an override through exactly one setResponsive with a null value', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(
      <InspectorPropertyRow
        scope={scopeFor(kernel, 'tablet')}
        propKey="title"
        schema={SCHEMA.shape.title}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear title override' }));
    const transactions = kernel.transactions();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.command).toBe('setResponsive');
    expect(kernel.getDocument().nodes['c1']?.responsive?.tablet?.['title']).toBeUndefined();
    expect(screen.queryByText('tablet override')).not.toBeInTheDocument();
  });
});
