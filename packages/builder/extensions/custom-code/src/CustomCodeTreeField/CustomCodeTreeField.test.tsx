import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { CustomCodeRoot, FieldProps } from '@craftkit/builder-schema';

import CustomCodeTreeField from './CustomCodeTreeField';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    { kind: 'element', tag: 'h2', text: 'Handmade in Amman' },
    { kind: 'element', tag: 'p', text: 'Thrown, trimmed and glazed by hand.' },
  ],
};

function renderField(value: unknown = TREE, overrides: Partial<FieldProps> = {}) {
  const onChange = vi.fn();
  const props: FieldProps = {
    schema: z.unknown(),
    value,
    path: ['props', 'tree'],
    onChange,
    ...overrides,
  };
  render(<CustomCodeTreeField {...props} />);
  return { onChange, field: screen.getByRole('textbox', { name: 'Composition tree' }) };
}

/**
 * Replace the whole text and leave the field, which is the one moment it
 * commits. `{` and `[` are key-descriptor syntax to `userEvent.type`, and JSON
 * is nothing but those — so they are doubled on the way in.
 */
async function write(field: HTMLElement, json: string): Promise<void> {
  await userEvent.clear(field);
  await userEvent.type(
    field,
    json.replace(/[{[]/gu, (char) => char + char),
  );
  await userEvent.tab();
}

describe('CustomCodeTreeField', () => {
  it('shows the stored tree as formatted JSON', () => {
    expect(renderField().field).toHaveValue(JSON.stringify(TREE, null, 2));
  });

  describe('the summary', () => {
    it('counts what the tree holds, for a reader who will not read the JSON', () => {
      renderField();
      expect(screen.getByText('2 elements.')).toBeInTheDocument();
    });

    it('says one element in the singular', () => {
      renderField({ kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'x' }] });
      expect(screen.getByText('1 element.')).toBeInTheDocument();
    });

    it('names the blocks a tree references, not just how many', () => {
      renderField({
        kind: 'root',
        children: [
          { kind: 'element', tag: 'p', text: 'x' },
          { kind: 'component', component: 'hero' },
        ],
      });
      expect(screen.getByText(/1 block reference: hero\./)).toBeInTheDocument();
    });

    it('calls an empty tree empty', () => {
      renderField({ kind: 'root', children: [] });
      expect(screen.getByText('Empty region.')).toBeInTheDocument();
    });

    it('describes the field, so the panel is informative before the JSON is read', () => {
      const { field } = renderField();
      const described = (field.getAttribute('aria-describedby') ?? '').split(' ');
      expect(document.getElementById(described[0] ?? '')).toHaveTextContent('2 elements.');
    });
  });

  describe('committing', () => {
    it('writes the PARSED tree, not the text', async () => {
      const { onChange, field } = renderField();
      await write(field, '{"kind":"root","children":[{"kind":"element","tag":"p","text":"hi"}]}');
      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        kind: 'root',
        children: [{ kind: 'element', tag: 'p', text: 'hi' }],
      });
    });

    it('commits once per edit session, not once per keystroke', async () => {
      const { onChange, field } = renderField();
      await write(field, '{"kind":"root","children":[]}');
      expect(onChange).toHaveBeenCalledOnce();
    });

    it('commits nothing when the text came back unchanged', async () => {
      const { onChange, field } = renderField();
      await userEvent.click(field);
      await userEvent.tab();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('refusing', () => {
    it('NEVER writes an invalid tree — it parses first and commits second', async () => {
      const { onChange, field } = renderField();
      await write(field, '{"kind":"root",');
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Not valid JSON');
    });

    it('says WHY, at the path that failed', async () => {
      const { onChange, field } = renderField();
      await write(field, '{"kind":"root","children":[{"kind":"element","tag":"script"}]}');
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toMatch(/children/u);
    });

    it('keeps the text as typed, so the edit is not lost with the error', async () => {
      const { field } = renderField();
      await write(field, '{"kind":"root",');
      expect(field).toHaveValue('{"kind":"root",');
    });

    it('marks the field invalid and points it at the reason', async () => {
      const { field } = renderField();
      await write(field, 'not json at all');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      const described = (field.getAttribute('aria-describedby') ?? '').split(' ');
      expect(described).toContain(screen.getByRole('alert').id);
    });

    it('clears the moment the person starts fixing it', async () => {
      const { field } = renderField();
      await write(field, 'not json at all');
      expect(screen.getByRole('alert')).toBeInTheDocument();
      await userEvent.type(field, ' ');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('is closed when the host says so', () => {
    expect(renderField(TREE, { disabled: true }).field).toBeDisabled();
  });
});
