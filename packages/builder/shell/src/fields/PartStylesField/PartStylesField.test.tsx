import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { partStylesProp, type BlockParts, type Node } from '@craftkit/builder-schema';

import { FieldServicesProvider } from '../field-services';
import { partRefOfStyleKey, partStyleKeyLabel, planPartStyleReset } from '../part-styles-reset';
import { PartStylesField } from './PartStylesField';

afterEach(cleanup);

const PARTS: BlockParts = {
  heading: { kind: 'text', bind: 'heading', label: { en: 'Heading', ar: 'العنوان' } },
  'item.title': {
    kind: 'text',
    bind: 'items.*.title',
    label: { en: 'Item title', ar: 'عنوان العنصر' },
  },
};

const VALUE = {
  heading: { className: 'ps-4 text-accent', dir: 'ltr' },
  'item.title@2': { dir: 'rtl' },
};

const props = (overrides: Record<string, unknown> = {}) => ({
  schema: partStylesProp() as z.ZodType,
  value: VALUE as unknown,
  path: ['props', 'partStyles'],
  onChange: vi.fn(),
  parts: PARTS,
  ...overrides,
});

describe('PartStylesField', () => {
  it('lists customised parts by their labels, with classes and direction — never JSON', () => {
    render(<PartStylesField {...props()} />);
    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('Item title 3')).toBeInTheDocument();
    expect(screen.getByText('ps-4')).toBeInTheDocument();
    expect(screen.getByText('Direction LTR')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('{');
  });

  it('Reset hands the host ONE key to reset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn(() => ({ ok: true as const }));
    render(<PartStylesField {...props({ onReset })} />);
    await user.click(screen.getByRole('button', { name: 'Reset Heading' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledWith('heading', 'Heading');
  });

  it('says so when no part has a style of its own', () => {
    render(<PartStylesField {...props({ value: undefined })} />);
    expect(screen.getByText('No part has its own style yet.')).toBeInTheDocument();
  });

  it('uses the Arabic labels under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <PartStylesField {...props({ onReset: () => ({ ok: true }) })} />
      </FieldServicesProvider>,
    );
    expect(screen.getByText('العنوان')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة ضبط العنوان' })).toBeInTheDocument();
  });
});

describe('planPartStyleReset', () => {
  const schema = z.object({ heading: z.string(), partStyles: partStylesProp() });
  const node = {
    id: 'n1',
    type: 'hero',
    props: { heading: 'Hi', partStyles: VALUE },
  } as unknown as Node;

  it('removes a styled entry in ONE setProp with a readable label', () => {
    const plan = planPartStyleReset(node, schema, 'heading', 'Hero', 'Heading');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.args).toEqual({
      id: 'n1',
      key: 'partStyles',
      value: { 'item.title@2': { dir: 'rtl' } },
    });
    expect(plan.label).toBe('Reset style · Hero Heading');
  });

  it('a direction-only entry goes through planPartDir', () => {
    const plan = planPartStyleReset(node, schema, 'item.title@2', 'Hero', 'Item title 3');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.args.value).toEqual({ heading: VALUE.heading });
    expect(plan.label.startsWith('Direction · ')).toBe(true);
  });

  it('refuses a key with nothing to reset', () => {
    const plan = planPartStyleReset(node, schema, 'missing', 'Hero', 'Missing');
    expect(plan.ok).toBe(false);
  });

  it('parses and labels style keys', () => {
    expect(partRefOfStyleKey('item.title@2')).toEqual({ part: 'item.title', index: [2] });
    expect(partRefOfStyleKey('heading')).toEqual({ part: 'heading', index: [] });
    expect(partStyleKeyLabel('item.title@0', PARTS, 'ar')).toBe('عنوان العنصر 1');
    expect(partStyleKeyLabel('unknown', PARTS, 'en')).toBe('unknown');
  });
});
