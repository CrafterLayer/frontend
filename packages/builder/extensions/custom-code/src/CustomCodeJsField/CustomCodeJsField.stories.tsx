import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { z } from 'zod';

import CustomCodeJsField from './CustomCodeJsField';

const SCENE = `const { PIXI, app } = await ck.stage({ pointer: true });
const dot = new PIXI.Graphics().circle(0, 0, 24).fill(0xe8a33d);
app.stage.addChild(dot);
app.ticker.add(() => {
  dot.position.set(app.screen.width / 2, app.screen.height / 2);
});`;

/**
 * The field holding its own value, the way the Inspector holds it.
 *
 * A frozen `value` prop would make every story a screenshot: the commit happens
 * across an edit, and cannot be seen without state.
 */
function LiveField({ initial = '', disabled = false }: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = useState<unknown>(initial);
  return (
    <div style={{ maxWidth: 420 }}>
      <CustomCodeJsField
        schema={z.string()}
        value={value}
        path={['props', 'js']}
        onChange={setValue}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: 'Builder/Extensions/CustomCodeJsField',
  component: LiveField,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LiveField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, with the hint that lists what the script receives. */
export const Empty: Story = {};

/** A Pixi scene drawn through `ck.stage()`. */
export const Written: Story = { args: { initial: SCENE } };

/** Closed by the host. */
export const Disabled: Story = { args: { initial: SCENE, disabled: true } };
