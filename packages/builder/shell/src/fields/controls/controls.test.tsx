import { z } from 'zod';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NumberField } from './NumberField';
import { ReadOnlyField } from './ReadOnlyField';
import { SelectField } from './SelectField';
import { SwitchField } from './SwitchField';
import { TextField } from './TextField';

afterEach(cleanup);

const base = (overrides: Record<string, unknown>) => ({
  schema: z.string() as z.ZodType,
  value: undefined as unknown,
  path: ['props', 'p'],
  onChange: vi.fn(),
  ...overrides,
});

describe('TextField', () => {
  it('renders the string value and commits each change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField {...base({ value: 'Hi', onChange, controlId: 'f1' })} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Hi');
    expect(input).toHaveAttribute('id', 'f1');
    await user.type(input, '!');
    expect(onChange).toHaveBeenCalledWith('Hi!');
  });

  it('shows the inherited placeholder when the value is absent', () => {
    render(<TextField {...base({ value: undefined, placeholder: 'Base title' })} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Base title');
  });
});

describe('SelectField', () => {
  it('derives its members from the enum schema and commits the pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SelectField
        {...base({ schema: z.enum(['left', 'center', 'right']), value: 'left', onChange })}
      />,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('left');
    await user.selectOptions(select, 'right');
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('derives members through optional wrappers and offers a blank when unset', () => {
    render(<SelectField {...base({ schema: z.enum(['a', 'b']).optional(), value: undefined })} />);
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['—', 'a', 'b']);
  });
});

describe('SwitchField', () => {
  it('exposes switch semantics and commits the toggle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchField {...base({ value: true, onChange })} />);
    const control = screen.getByRole('switch');
    expect(control).toBeChecked();
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe('NumberField', () => {
  it('commits only finite parses while typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField {...base({ value: 4, onChange })} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(4);
    await user.clear(input); // empty draft — no commit
    expect(onChange).not.toHaveBeenCalled();
    await user.type(input, '42');
    expect(onChange).toHaveBeenLastCalledWith(42);
  });

  it('renders document truth when not focused', () => {
    render(<NumberField {...base({ value: 7 })} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(7);
  });
});

describe('ReadOnlyField', () => {
  it('shows the JSON value, read-only', () => {
    render(<ReadOnlyField {...base({ value: { items: [1] } })} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('{"items":[1]}');
    expect(input).toHaveAttribute('readonly');
  });
});

describe('draft discipline (007 review H2/H4 fixes)', () => {
  it('TextField: a door-rejected state stays visible as a draft — no snap-back mid-edit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn(); // the host rejected: value prop never changes
    const view = render(<TextField {...base({ value: 'B', onChange })} />);
    const input = screen.getByRole('textbox');
    await user.clear(input); // min(1)-style rejection upstream — doc keeps 'B'
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue(''); // the draft, not a snap-back to 'B'

    // An EXTERNAL write wins immediately (document truth):
    view.rerender(<TextField {...base({ value: 'External', onChange })} />);
    expect(screen.getByRole('textbox')).toHaveValue('External');
  });

  it('TextField: undo back to the starting value drops the draft (no stale echo)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<TextField {...base({ value: 'Hello', onChange })} />);
    await user.type(screen.getByRole('textbox'), '!');
    view.rerender(<TextField {...base({ value: 'Hello!', onChange })} />); // commit applied
    expect(screen.getByRole('textbox')).toHaveValue('Hello!');
    view.rerender(<TextField {...base({ value: 'Hello', onChange })} />); // undo
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('NumberField: an external write shows through MID-FOCUS (FR-003 — review M3)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<NumberField {...base({ value: 16, onChange })} />);
    const input = screen.getByRole('spinbutton');
    await user.click(input); // focus alone must NOT detach from the document
    view.rerender(<NumberField {...base({ value: 12, onChange })} />); // external undo
    expect(input).toHaveValue(12);

    await user.type(input, '0'); // now typing works from the TRUE value
    expect(onChange).toHaveBeenLastCalledWith(120);
  });
});
