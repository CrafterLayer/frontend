import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { z } from 'zod';

import { SwitchField } from '../controls/SwitchField';
import { TextField } from '../controls/TextField';
import { unwrapSchema } from '../resolve-field';
import { ObjectField, type ObjectFieldRowProps } from './ObjectField';

const schema = z.object({
  label: z.string().max(40),
  href: z.string().max(80),
  newTab: z.boolean().default(false),
});

/** The Inspector renders each sub-row through its own field resolution; this mirrors it. */
function Row({
  row: { propKey, schema: rowSchema, value, path, commit },
}: {
  row: ObjectFieldRowProps;
}) {
  const isBoolean = unwrapSchema(rowSchema)._zod.def.type === 'boolean';
  return (
    <label style={{ display: 'grid', gap: '0.25rem' }}>
      {propKey}
      {isBoolean ? (
        <SwitchField schema={rowSchema} value={value} path={path} onChange={commit} />
      ) : (
        <TextField schema={rowSchema} value={value} path={path} onChange={commit} />
      )}
    </label>
  );
}

function Harness() {
  const [value, setValue] = useState<unknown>({
    label: 'Watch the film',
    href: '/film',
    newTab: false,
  });
  return (
    <div style={{ maxInlineSize: '18rem', padding: '1rem' }}>
      <span id="cta">Call to action</span>
      <ObjectField
        schema={schema}
        value={value}
        path={['props', 'cta']}
        labelledBy="cta"
        commit={(next) => {
          setValue(next);
          return { ok: true };
        }}
        renderRow={(row) => <Row key={row.key} row={row} />}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Shell/Fields/ObjectField',
  component: ObjectField,
  args: {
    schema,
    value: undefined,
    path: ['props', 'cta'],
    commit: () => ({ ok: true }),
    renderRow: () => null,
  },
} satisfies Meta<typeof ObjectField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const GroupedRows: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Call to action' })).toBeInTheDocument();
    const href = canvas.getByRole('textbox', { name: 'href' });
    await userEvent.type(href, '?t=1');
    await expect(href).toHaveValue('/film?t=1');
  },
};

export const RightToLeft: Story = {
  render: () => (
    <div dir="rtl">
      <Harness />
    </div>
  ),
  globals: { direction: 'rtl' },
};
