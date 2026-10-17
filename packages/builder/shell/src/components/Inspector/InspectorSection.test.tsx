import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBuilder, emptyDocument } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { InspectorSection } from './InspectorSection';
import type { InspectorRowScope, InspectorSectionModel } from './types';

const rows = vi.hoisted(() => ({ renders: 0 }));

// The rows are stubbed: this file measures the SECTION, and a stub that is not
// memoised re-runs exactly when the section body does.
vi.mock('./InspectorPropertyRow', () => ({
  InspectorPropertyRow: (props: { propKey: string; pairItemLabel?: string | undefined }) => {
    rows.renders += 1;
    return <div data-testid="row">{props.pairItemLabel ?? props.propKey}</div>;
  },
}));

const kernel = createBuilder({
  document: emptyDocument(),
  ports: { clock: fixedClock(), ids: seededIds('sec') },
});

const scope: InspectorRowScope = {
  kernel,
  nodeId: 'root',
  bucket: 'base',
  catalogVersion: 0,
  palette: [],
  onRetheme: undefined,
  announce: () => undefined,
  dir: 'ltr',
  declarations: undefined,
};

const section: InspectorSectionModel = {
  name: 'Spacing',
  entries: [
    { kind: 'property', property: ['gap', z.number()] },
    {
      kind: 'pair',
      id: 'margin',
      label: 'Margin',
      properties: [
        {
          property: ['marginTop', z.number()],
          pair: { id: 'margin', label: 'Margin', cellLabel: 'Top' },
        },
        {
          property: ['marginBottom', z.number()],
          pair: { id: 'margin', label: 'Margin', cellLabel: 'Bottom' },
        },
      ],
    },
  ],
};

beforeEach(() => {
  rows.renders = 0;
});

describe('InspectorSection', () => {
  it('is a heading-level toggle controlling a named region that keeps its rows when collapsed', () => {
    render(
      <InspectorSection
        section={section}
        collapseKey="k"
        expanded={false}
        onToggle={vi.fn()}
        scope={scope}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Spacing' });
    expect(toggle.closest('h3')).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute('aria-labelledby', toggle.id);
    expect(region).toHaveAttribute('hidden');
    expect(
      within(region!)
        .getAllByTestId('row')
        .map((row) => row.textContent),
    ).toEqual(['gap', 'Top', 'Bottom']);
    expect(region?.querySelector('[data-property-pair="margin"]')).not.toBeNull();
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(toggle.querySelector('.bldr-inspector__chevron')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
  });

  it('reports its key on toggle and bails on a parent render with identical props', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <InspectorSection
        section={section}
        collapseKey="k"
        expanded
        onToggle={onToggle}
        scope={scope}
      />,
    );
    expect(rows.renders).toBe(3);
    expect(screen.getByRole('button', { name: 'Spacing' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Spacing' }));
    expect(onToggle).toHaveBeenCalledWith('k');

    rows.renders = 0;
    view.rerender(
      <InspectorSection
        section={section}
        collapseKey="k"
        expanded
        onToggle={onToggle}
        scope={scope}
      />,
    );
    expect(rows.renders).toBe(0);

    view.rerender(
      <InspectorSection
        section={section}
        collapseKey="k"
        expanded={false}
        onToggle={onToggle}
        scope={scope}
      />,
    );
    expect(rows.renders).toBe(3);
  });
});
