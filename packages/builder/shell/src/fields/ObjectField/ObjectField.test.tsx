import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ObjectField, type ObjectFieldRowProps } from './ObjectField';

afterEach(cleanup);

const schema = z.object({
  label: z.string().max(40),
  href: z.string(),
  newTab: z.boolean().default(false),
});

function TextRow({ row: { propKey, value, commit, path } }: { row: ObjectFieldRowProps }) {
  return (
    <label>
      {propKey}
      <input
        data-path={path.join('.')}
        value={typeof value === 'string' ? value : typeof value === 'boolean' ? String(value) : ''}
        onChange={(event) => {
          commit(event.target.value);
        }}
      />
    </label>
  );
}

describe('ObjectField', () => {
  it('renders one grouped sub-row per object key, with nested paths', () => {
    render(
      <>
        <span id="cta-label">CTA</span>
        <ObjectField
          schema={schema}
          value={{ label: 'Start', href: '/start', newTab: false }}
          path={['props', 'cta']}
          labelledBy="cta-label"
          commit={vi.fn(() => ({ ok: true as const }))}
          renderRow={(row) => <TextRow key={row.key} row={row} />}
        />
      </>,
    );
    const group = screen.getByRole('group', { name: 'CTA' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'label' })).toHaveValue('Start');
    expect(screen.getByRole('textbox', { name: 'href' })).toHaveAttribute(
      'data-path',
      'props.cta.href',
    );
  });

  it('writes the WHOLE object once per sub-edit (one Undo)', async () => {
    const user = userEvent.setup();
    const commit = vi.fn(() => ({ ok: true as const }));
    render(
      <ObjectField
        schema={schema}
        value={{ label: 'Go', href: '/a', newTab: true }}
        path={['props', 'cta']}
        commit={commit}
        renderRow={(row) => <TextRow key={row.key} row={row} />}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'href' }), 'b');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ label: 'Go', href: '/ab', newTab: true });
  });

  it('seeds an absent optional object from the schema before the first write', async () => {
    const user = userEvent.setup();
    const commit = vi.fn(() => ({ ok: true as const }));
    render(
      <ObjectField
        schema={schema.optional()}
        value={undefined}
        path={['props', 'cta']}
        commit={commit}
        renderRow={(row) => <TextRow key={row.key} row={row} />}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'label' }), 'X');
    const written = (commit.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(written['label']).toBe('X');
    expect(written['newTab']).toBe(false);
  });

  it('leaves out keys another field renders itself', () => {
    render(
      <ObjectField
        schema={schema}
        value={{ label: 'Go', href: '/a', newTab: true }}
        path={['props', 'cta']}
        omitKeys={['label', 'href']}
        commit={vi.fn(() => ({ ok: true as const }))}
        renderRow={(row) => <TextRow key={row.key} row={row} />}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'label' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'newTab' })).toBeInTheDocument();
  });
});
