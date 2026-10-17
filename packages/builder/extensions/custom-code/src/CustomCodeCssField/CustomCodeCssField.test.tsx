import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { FieldProps } from '@craftkit/builder-schema';

import CustomCodeCssField from './CustomCodeCssField';

function renderField(overrides: Partial<FieldProps> = {}) {
  const onChange = vi.fn();
  const props: FieldProps = {
    schema: z.string(),
    value: '',
    path: ['props', 'css'],
    onChange,
    ...overrides,
  };
  render(<CustomCodeCssField {...props} />);
  return { onChange, field: screen.getByRole('textbox', { name: 'Custom CSS' }) };
}

/**
 * Type a sheet and leave the field, which is the one moment it commits.
 *
 * `{` and `[` are key-descriptor syntax to `userEvent.type`, and CSS is mostly
 * braces — so they are doubled on the way in. Typing rather than setting the
 * value on purpose: the commit is on blur, and a test that set the value
 * directly would never prove that.
 */
async function write(field: HTMLElement, css: string): Promise<void> {
  await userEvent.clear(field);
  await userEvent.type(
    field,
    css.replace(/[{[]/gu, (char) => char + char),
  );
  await userEvent.tab();
}

describe('CustomCodeCssField', () => {
  it('shows the stored stylesheet', () => {
    const { field } = renderField({ value: '.ck-card { color: red }' });
    expect(field).toHaveValue('.ck-card { color: red }');
  });

  it('shows an empty box for a value that is not a string', () => {
    expect(renderField({ value: null }).field).toHaveValue('');
  });

  it('commits ONE change per edit session, not one per keystroke', async () => {
    const { onChange, field } = renderField();
    await write(field, '.a{color:red}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('.a{color:red}');
  });

  it('commits nothing when the text came back unchanged', async () => {
    const { onChange, field } = renderField({ value: '.a{color:red}' });
    await userEvent.click(field);
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  describe('the refusal', () => {
    it('REFUSES rather than strips — a silently removed line is the worse betrayal', async () => {
      const { onChange, field } = renderField();
      await write(field, '@import url("https://evil.test/x.css");');
      expect(onChange).not.toHaveBeenCalled();
      expect(field).toHaveValue('@import url("https://evil.test/x.css");');
    });

    it('names the rule it refused, and says what to do', async () => {
      const { field } = renderField();
      await write(field, '.a{width:expression(alert(1))}');
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('expression()');
      expect(alert).toHaveTextContent('Remove it to save');
    });

    it('marks the field invalid and points it at the reason', async () => {
      const { field } = renderField();
      await write(field, '.a{behavior:url(#default#time2)}');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      const describedBy = field.getAttribute('aria-describedby') ?? '';
      expect(describedBy.split(' ')).toContain(screen.getByRole('alert').id);
    });

    it('clears the moment the person starts fixing it', async () => {
      const { field } = renderField();
      await write(field, '.a{width:expression(alert(1))}');
      expect(screen.getByRole('alert')).toBeInTheDocument();
      await userEvent.type(field, ' ');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(field).toHaveAttribute('aria-invalid', 'false');
    });

    it('applies the SAME list the renderer does — an https image is allowed', async () => {
      const { onChange, field } = renderField();
      await write(field, '.a{background-image:url("https://img.test/a.jpg")}');
      expect(onChange).toHaveBeenCalledOnce();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('allows a font @import, which is the one import that is not a leak', async () => {
      const { onChange, field } = renderField();
      await write(field, '@import url("https://fonts.googleapis.com/css2?family=Inter");');
      expect(onChange).toHaveBeenCalledOnce();
    });
  });

  it('says how the sheet is scoped, without being asked', () => {
    const { field } = renderField();
    const hint = field.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(hint.split(' ')[0] ?? '')).toHaveTextContent(
      'Scoped to this block',
    );
  });

  it('is closed when the host says so', () => {
    expect(renderField({ disabled: true }).field).toBeDisabled();
  });
});
