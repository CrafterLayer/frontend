import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import {
  customCodeJsParams,
  type CustomCodeJsParams,
  type ScriptParamSpec,
} from '@craftkit/builder-schema';

import { CustomCodeParamsField } from './index';
import { SCENE_PICTURES, SCENE_SPEC, sceneSiblings } from './CustomCodeParamsField.fixture';

interface LiveFieldProps {
  /** The stored `jsParams`. */
  initial?: CustomCodeJsParams | undefined;
  /** The Studio's spec (`jsMeta.params`); `null` — no spec at all. */
  spec?: readonly ScriptParamSpec[] | null;
  locale?: 'en' | 'ar';
  disabled?: boolean;
  /** Offer the host's picture library to the image param. */
  library?: boolean;
  /** Each write the Inspector would dispatch as one setProp. */
  onCommit?: (next: unknown) => void;
}

/**
 * The field holding its own value, the way the Inspector holds it: a commit
 * becomes the next `value`, so Reset and merging can be seen across edits.
 */
function LiveField({
  initial,
  spec = SCENE_SPEC,
  locale = 'en',
  disabled = false,
  library = false,
  onCommit,
}: LiveFieldProps) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <div className="bldr-root" style={{ inlineSize: 288, maxInlineSize: '100%' }}>
      <CustomCodeParamsField
        schema={customCodeJsParams()}
        value={value}
        path={['props', 'jsParams']}
        onChange={(next) => {
          onCommit?.(next);
          setValue(next);
        }}
        siblings={spec === null ? [] : sceneSiblings(spec)}
        locale={locale}
        disabled={disabled}
        assetLibrary={library ? SCENE_PICTURES : undefined}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/CustomCodeParamsField',
  component: LiveField,
  parameters: { layout: 'centered' },
  args: { onCommit: fn() },
} satisfies Meta<typeof LiveField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every param type of a Studio spec, in spec order; a toggle is one write. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const pointer = canvas.getByRole('switch', { name: 'Follow the pointer' });
    if (pointer.getAttribute('aria-checked') === 'true') {
      await userEvent.click(canvas.getByRole('button', { name: 'Reset Follow the pointer' }));
    }
    await userEvent.click(pointer);
    await expect(pointer).toHaveAttribute('aria-checked', 'true');
    await expect(args.onCommit).toHaveBeenLastCalledWith({ interactive: true });
    await expect(
      canvas.getByRole('button', { name: 'Reset Follow the pointer' }),
    ).toBeInTheDocument();
  },
};

/** Stored values beside the spec: changed controls offer Reset; `legacy` is kept on every write. */
export const Changed: Story = {
  args: { initial: { speed: 2.5, title: 'Night sky', tint: '#2f6f73', legacy: 'kept' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByRole('textbox', { name: 'Title' });
    if (canvas.queryByRole('button', { name: 'Reset Title' }) === null) {
      await userEvent.clear(title);
      await userEvent.type(title, 'Night sky{Enter}');
    }
    await userEvent.click(canvas.getByRole('button', { name: 'Reset Title' }));
    await expect(title).toHaveValue('Hello');
    // The default is not written back, and the key outside the spec survives.
    await expect(args.onCommit).toHaveBeenLastCalledWith({
      speed: 2.5,
      tint: '#2f6f73',
      legacy: 'kept',
    });
  },
};

/** No spec: each stored key gets a plain control by its value's type. */
export const WithoutSpec: Story = {
  args: { spec: null, initial: { count: 40, glow: true, tint: '#e8a33d', caption: 'Hello' } },
};

/** The host's picture library beside the image address. */
export const PictureLibrary: Story = {
  args: { library: true, spec: SCENE_SPEC.filter((entry) => entry.type === 'image') },
};

/** Nothing to tune; the Inspector leaves this row out, a bare host sees the note. */
export const Empty: Story = { args: { spec: null } };

export const Disabled: Story = { args: { disabled: true, initial: { speed: 2 } } };

/** Labels from the spec in Arabic, laid out right to left. */
export const Arabic: Story = { args: { locale: 'ar' }, globals: { direction: 'rtl' } };
