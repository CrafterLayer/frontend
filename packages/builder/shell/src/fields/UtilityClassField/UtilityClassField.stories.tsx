import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import { UtilityClassField } from './UtilityClassField';

const schema = z.string().optional();

/**
 * The field is controlled, and every story drives it the way the Inspector
 * does — a story holding no state would show a chip appear and then vanish on
 * the next render, which is the opposite of the behaviour under test.
 */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState<string | undefined>(initial === '' ? undefined : initial);

  return (
    <div>
      <UtilityClassField
        schema={schema}
        value={value}
        path={['className']}
        controlId="utilities"
        onChange={(next) => {
          setValue(typeof next === 'string' ? next : undefined);
        }}
      />
      <p data-testid="stored" className="bldr-visually-hidden">
        {value ?? '(unset)'}
      </p>
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/UtilityClassField',
  component: UtilityClassField,
  /*
    Every story below renders its own controlled harness, so these satisfy the
    component's required props for the type and the controls panel and are not
    what the stories actually mount.
  */
  args: {
    schema,
    value: undefined,
    path: ['className'],
    controlId: 'utilities',
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UtilityClassField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => <Harness />,
};

export const WithClasses: Story = {
  render: () => <Harness initial="flex flex-col gap-4 bg-surface-inverse lg:grid-cols-3" />,
};

export const Disabled: Story = {
  render: () => (
    <UtilityClassField
      schema={schema}
      value="flex gap-4"
      path={['className']}
      controlId="utilities"
      onChange={() => undefined}
      disabled
    />
  ),
};

/**
 * The refusal, rendered.
 *
 * A geometry-free contract, deliberately: what matters is that the reason is
 * present in the accessibility tree as an alert and reaches the input through
 * `aria-describedby`. A red border that a screen reader cannot see is not a
 * validation message, it is a decoration.
 */
export const RefusalContract: Story = {
  render: () => <Harness initial="flex" />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await step("Tailwind's own palette is refused, with the replacement named", async () => {
      await userEvent.click(input);
      await userEvent.paste('bg-blue-500');
      await userEvent.keyboard('{Enter}');

      const alert = canvas.getByRole('alert');
      await expect(alert).toHaveTextContent('bg-accent');
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAccessibleDescription(/bg-accent/);
      /* The good class it was added beside is untouched. */
      await expect(canvas.getByTestId('stored')).toHaveTextContent('flex');
    });

    await step('an accepted class clears the refusal and becomes a chip', async () => {
      await userEvent.clear(input);
      await userEvent.paste('bg-accent');
      await userEvent.keyboard('{Enter}');

      await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
      await expect(canvas.getByRole('button', { name: 'Remove bg-accent' })).toBeInTheDocument();
      await expect(canvas.getByTestId('stored')).toHaveTextContent('flex bg-accent');
    });

    await step('removing a chip removes only that class', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Remove flex' }));

      await expect(canvas.getByTestId('stored')).toHaveTextContent('bg-accent');
      await expect(canvas.queryByRole('button', { name: 'Remove flex' })).not.toBeInTheDocument();
    });
  },
};

/** Free mode, for elements of agent trees: exact values are admitted. */
export const FreeMode: Story = {
  args: { value: 'flex p-[18px] bg-[#0f766e] ck-fx-glass', mode: 'free' },
};
