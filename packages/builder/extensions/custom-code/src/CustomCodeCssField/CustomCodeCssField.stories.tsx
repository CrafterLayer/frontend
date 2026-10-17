import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod';

import CustomCodeCssField from './CustomCodeCssField';

const SHEET = `.ck-card { border: 1px solid var(--t-accent); border-radius: 12px; padding: 20px }
.ck-card__title { color: var(--t-accent); margin: 0 0 8px }`;

/**
 * The field holding its own value, the way the Inspector holds it.
 *
 * A frozen `value` prop would make every story a screenshot: the refusal, the
 * commit and the recovery all happen across an edit, and none of them can be
 * seen without state.
 */
function LiveField({ initial = '', disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <div style={{ maxWidth: 420 }}>
      <CustomCodeCssField
        schema={z.string()}
        value={value}
        path={['props', 'css']}
        onChange={setValue}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/CustomCodeCssField',
  component: LiveField,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LiveField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, with the hint that says how the sheet is scoped. */
export const Empty: Story = {};

/** A stylesheet that reaches its colours through a token, so the page re-themes. */
export const Written: Story = { args: { initial: SHEET } };

/**
 * A refused rule. Type `@import url("https://evil.test/x.css")` and leave the
 * box: the field declines to store it and says which rule and why. It refuses
 * rather than strips — silently removing a line a person wrote is the worse
 * betrayal, because they do not notice until the page is wrong.
 */
export const RefusesAnImport: Story = {
  args: { initial: '@import url("https://evil.test/x.css");' },
};

/** Closed by the host. */
export const Disabled: Story = { args: { initial: SHEET, disabled: true } };
