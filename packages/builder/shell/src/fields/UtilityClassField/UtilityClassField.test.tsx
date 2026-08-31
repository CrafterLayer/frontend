import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { UtilityClassField } from './UtilityClassField';

afterEach(cleanup);

const schema = z.string().optional();

function renderField(value: unknown, onChange = vi.fn()) {
  render(
    <UtilityClassField
      schema={schema}
      value={value}
      path={['className']}
      onChange={onChange}
      controlId="utilities"
    />,
  );
  return onChange;
}

/*
  `combobox`, not `textbox`: an <input type="text"> carrying a `list` maps to
  the combobox role. That is the correct mapping — the control does offer a
  list of values — and asserting it here keeps the suggestions from being
  quietly dropped, since losing them would change the role back.
*/
describe('UtilityClassField', () => {
  it('shows one removable chip per applied class', () => {
    renderField('flex flex-col gap-4');

    expect(screen.getByText('flex')).toBeInTheDocument();
    expect(screen.getByText('flex-col')).toBeInTheDocument();
    expect(screen.getByText('gap-4')).toBeInTheDocument();
    /*
      Named after the class, not "Remove". Three buttons all called "Remove" is
      a list nobody using a screen reader can navigate.
    */
    expect(screen.getByRole('button', { name: 'Remove flex-col' })).toBeInTheDocument();
  });

  it('adds a class on Enter and stores the whole list', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex');

    await user.type(screen.getByRole('combobox'), 'items-center{Enter}');

    expect(onChange).toHaveBeenCalledWith('flex items-center');
  });

  it('removes only the chip that was clicked', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex flex-col gap-4');

    await user.click(screen.getByRole('button', { name: 'Remove flex-col' }));

    expect(onChange).toHaveBeenCalledWith('flex gap-4');
  });

  /*
    The two refusals from `schema/src/blocks/utility-classes.ts`, checked at the
    point of entry rather than on commit. The old text input bounced the ENTIRE
    string, so one bad class discarded eight good ones and the reason arrived
    after the typing was finished.
  */
  it('refuses an arbitrary value and says what to use instead', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex');

    /*
      Pasted, not typed: userEvent reads `[…]` as a key descriptor, so a typed
      `p-[17px]` never reaches the field as the string a person would paste out
      of a Tailwind snippet — which is exactly how this class arrives in real
      life.
    */
    await user.click(screen.getByRole('combobox'));
    await user.paste('p-[17px]');
    await user.keyboard('{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('p-4');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it("refuses Tailwind's own palette, which the design system cannot reach", async () => {
    const user = userEvent.setup();
    const onChange = renderField('');

    await user.type(screen.getByRole('combobox'), 'bg-blue-500{Enter}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('bg-accent');
  });

  /*
    Non-vacuity for the pair above: the refusals must be narrow. A field that
    rejected everything would satisfy both tests and be useless.
  */
  it('accepts the token-bound and responsive vocabulary', async () => {
    const user = userEvent.setup();
    const onChange = renderField('');

    await user.type(screen.getByRole('combobox'), 'lg:bg-accent{Enter}');

    expect(onChange).toHaveBeenCalledWith('lg:bg-accent');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears the property rather than storing an empty string', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex');

    await user.click(screen.getByRole('button', { name: 'Remove flex' }));

    /*
      `className` is optional on every block. An empty string is a value that
      says nothing while still counting as set, and it would survive into the
      document and into published markup as `class=""`.
    */
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('never adds the same class twice', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex gap-4');

    await user.type(screen.getByRole('combobox'), 'flex{Enter}');

    expect(onChange).toHaveBeenCalledWith('flex gap-4');
  });

  it('splits a pasted list into separate chips', async () => {
    const user = userEvent.setup();
    const onChange = renderField('');

    await user.click(screen.getByRole('combobox'));
    await user.paste('flex items-center gap-4');
    await user.keyboard('{Enter}');

    /*
      ONE commit holding three classes, not three commits. Typing the same
      characters would commit on each space, and each commit reads the value
      prop — so in a controlled host that has not re-rendered yet, the second
      would overwrite the first. A paste is the case where that distinction is
      visible.
    */
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('flex items-center gap-4');
  });

  it('removes the last chip on backspace in an empty field', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex gap-4');

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith('flex');
  });

  it('commits a pending class on blur, so a typed value is never silently lost', async () => {
    const user = userEvent.setup();
    const onChange = renderField('flex');

    await user.type(screen.getByRole('combobox'), 'gap-4');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('flex gap-4');
  });

  it('offers suggestions and never repeats one already applied', () => {
    renderField('flex bg-accent');

    const options = [...document.querySelectorAll('datalist option')].map(
      (option) => (option as HTMLOptionElement).value,
    );

    expect(options.length).toBeGreaterThan(0);
    expect(options).not.toContain('flex');
    expect(options).not.toContain('bg-accent');
  });
});
