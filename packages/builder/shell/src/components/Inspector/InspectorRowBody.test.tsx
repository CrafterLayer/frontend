import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder, emptyDocument } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import type { FieldCommit } from '../../fields/field-commit';
import { InspectorRowBody } from './InspectorRowBody';
import type { InspectorRowBodyProps } from './types';

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'Inspector', 'InspectorRow.css'),
  'utf8',
);

const kernel = createBuilder({
  document: emptyDocument(),
  ports: { clock: fixedClock(), ids: seededIds('rb') },
});

const baseProps = (overrides: Partial<InspectorRowBodyProps> = {}): InspectorRowBodyProps => ({
  kernel,
  nodeId: 'root',
  propKey: 'lineHeight',
  schema: z.number().default(24),
  palette: [],
  bucket: 'base',
  value: 24,
  baseValue: 24,
  hasOverride: false,
  catalogVersion: 0,
  announce: () => undefined,
  dir: 'ltr',
  ...overrides,
});

describe('InspectorRowBody', () => {
  it('declares the mono face and tabular digits on numeric values', () => {
    expect(CSS_SOURCE).toMatch(
      /\.bldr-inspector__numeric-control \.bldr-field__input\s*\{[^}]*font-family:\s*var\(--bldr-font-mono\);[^}]*font-variant-numeric:\s*tabular-nums;[^}]*\}/su,
    );
  });

  it('lays out label, control and unit: label[for], hidden key, unit as the input’s next sibling', () => {
    render(<InspectorRowBody {...baseProps()} />);
    const input = screen.getByRole('spinbutton', { name: 'lineHeight' });
    const row = input.closest('.bldr-inspector__row');
    expect(row).not.toBeNull();
    expect(row?.className).toBe('bldr-inspector__row');
    const label = row?.querySelector('label');
    expect(label).toHaveAttribute('for', input.id);
    expect(label?.querySelector('[aria-hidden="true"]')).toHaveTextContent('Line height');
    expect(label?.querySelector('.bldr-visually-hidden')).toHaveTextContent('lineHeight');
    const unit = input.nextElementSibling;
    expect(unit).toHaveClass('bldr-inspector__unit');
    expect(unit).toHaveAttribute('aria-hidden', 'true');
    expect(unit).toHaveTextContent('px');
    expect(screen.queryByRole('img', { name: 'Supports device overrides' })).toBeNull();
  });

  it('describes the control by its override marker and shows the device glyph only on capable root rows', () => {
    render(
      <InspectorRowBody
        {...baseProps({ bucket: 'tablet', value: 20, hasOverride: true, responsiveCapable: true })}
      />,
    );
    const input = screen.getByRole('spinbutton', { name: 'lineHeight' });
    const marker = screen.getByText('tablet override');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(marker.id);
    expect(screen.getByRole('button', { name: 'Clear lineHeight override' })).toHaveClass(
      'bldr-inspector__override-clear',
    );
    expect(screen.getByRole('img', { name: 'Supports device overrides' })).toBeInTheDocument();
  });

  it('keeps a nested deferred draft while the incoming value holds and drops it when the value moves', async () => {
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: false, message: 'kept as a draft' }));
    const user = userEvent.setup();
    const props = baseProps({
      propKey: 'name',
      schema: z.string(),
      value: 'a',
      baseValue: 'a',
      nested: true,
      deferTextCommit: true,
      commitValue,
    });
    const view = render(<InspectorRowBody {...props} />);
    const input = screen.getByRole('textbox', { name: 'name' });
    await user.type(input, 'b');
    expect(input).toHaveValue('ab');
    expect(commitValue).not.toHaveBeenCalled();

    view.rerender(<InspectorRowBody {...props} />);
    expect(input).toHaveValue('ab');

    view.rerender(<InspectorRowBody {...props} value="z" baseValue="z" />);
    expect(input).toHaveValue('z');
  });

  it('commits a nested draft once on Enter and keeps the rejection on its own row', async () => {
    const commitValue = vi.fn<FieldCommit>(() => ({ ok: false, message: 'nested no' }));
    const user = userEvent.setup();
    render(
      <InspectorRowBody
        {...baseProps({
          propKey: 'name',
          schema: z.string(),
          value: 'a',
          baseValue: 'a',
          nested: true,
          deferTextCommit: true,
          commitValue,
        })}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'name' });
    await user.type(input, 'b{Enter}');
    expect(commitValue).toHaveBeenCalledTimes(1);
    expect(commitValue).toHaveBeenCalledWith('ab');
    const rejection = screen.getByText('nested no');
    expect(rejection).toHaveClass('bldr-inspector__rejection');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(rejection.id);
    expect(input).toHaveValue('ab');
  });
});
