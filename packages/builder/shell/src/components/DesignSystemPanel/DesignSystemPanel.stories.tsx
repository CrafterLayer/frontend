import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { defaultDesignSystem, type DesignSystem, type TokenName } from '@craftkit/builder-schema';

import { DesignSystemPanel } from './DesignSystemPanel';

const meta = {
  title: 'Shell/DesignSystemPanel',
  component: DesignSystemPanel,
  parameters: { layout: 'padded' },
  args: { system: defaultDesignSystem(), onChangeToken: fn() },
  argTypes: { system: { control: false }, onChangeToken: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '24rem', background: 'var(--bldr-panel)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DesignSystemPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The system a site was generated with. */
export const Default: Story = {};

/** Editing: seven keystrokes, and not one dispatch until the field is left. */
export const Editing: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('accent');
    await userEvent.clear(field);
    await userEvent.type(field, '#0b5cff');
    await expect(args.onChangeToken).not.toHaveBeenCalled();

    await userEvent.tab();
    await waitFor(async () => {
      await expect(args.onChangeToken).toHaveBeenCalledWith('accent', '#0b5cff');
    });
  },
};

/**
 * Regenerating: the run owns the panel, so nothing may be committed while it
 * goes. The action is offered only because a host wired it.
 */
export const Regenerating: Story = {
  args: { onRegenerate: fn(), busy: true },
};

/** The door refused the colour, and says so where a person is already looking. */
export const ContrastWarning: Story = {
  args: {
    issues: ['"accent" on "surface" measures 1.23:1, below the 4.5:1 this text size needs.'],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('below the 4.5:1');
    await expect(canvas.getByLabelText('accent')).toHaveAttribute('aria-invalid', 'true');
  },
};

/**
 * An EXTERNAL write beats an open draft.
 *
 * The story owns the system so the change can arrive from outside mid-edit,
 * which is what a landing generation or another tab does.
 */
export const ExternalWriteWins: Story = {
  render: (args) => {
    const [system, setSystem] = useState<DesignSystem>(args.system);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const base = defaultDesignSystem();
            setSystem({ ...base, tokens: { ...base.tokens, accent: '#222222' } });
          }}
        >
          commit elsewhere
        </button>
        <DesignSystemPanel
          {...args}
          system={system}
          onChangeToken={(token: TokenName, value: string) => {
            args.onChangeToken(token, value);
          }}
        />
      </>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText('accent');
    await userEvent.clear(field);
    await userEvent.type(field, '#abcabc');
    await expect(field).toHaveValue('#abcabc');

    await userEvent.click(canvas.getByRole('button', { name: 'commit elsewhere' }));
    await waitFor(async () => {
      await expect(canvas.getByLabelText('accent')).toHaveValue('#222222');
    });
  },
};

/** RTL: the panel reads right to left; the token names stay what they are. */
export const RightToLeft: Story = {
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};
