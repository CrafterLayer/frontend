import { expect, fn, userEvent, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { darkTheme, lightTheme, paletteOf } from '@craftkit/builder-renderer';

import { ColorRoleField } from './ColorRoleField';

const lightPalette = paletteOf(lightTheme);
const darkPalette = paletteOf(darkTheme);
const lightSurface = lightPalette.find((entry) => entry.role === 'surface');
const darkSurface = darkPalette.find((entry) => entry.role === 'surface');

if (lightSurface === undefined || darkSurface === undefined) {
  throw new Error('Both story palettes must define the surface role.');
}

const meta = {
  title: 'Builder/Shell/Fields/ColorRoleField',
  component: ColorRoleField,
  decorators: [
    (Story) => (
      <div className="bldr-root" style={{ maxInlineSize: '20rem', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    schema: z.string(),
    value: 'accent',
    path: ['props', 'background'],
    onChange: fn(),
    palette: lightPalette,
    labelledBy: 'color-role-story-label',
    describedBy: 'color-role-story-description',
  },
} satisfies Meta<typeof ColorRoleField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RolesOnly: Story = {
  args: {
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('radio')).toHaveLength(lightPalette.length);
    await expect(
      canvas.queryByRole('button', { name: /Edit the .* colour/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('radio', { name: 'Inverse surface' }));
    await expect(args.onChange).toHaveBeenCalledWith('surfaceInverse');
  },
};

export const RolesAndPicker: Story = {
  args: {
    onChange: fn(),
    onRetheme: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Edit the Accent colour' });

    await userEvent.click(trigger);
    await expect(documentBody.getByText('Re-points “Accent” everywhere it is used.')).toBeVisible();
  },
};

export const DarkPageTheme: Story = {
  args: {
    value: 'surface',
    onChange: fn(),
    palette: darkPalette,
  },
  render: (args) => (
    <div data-bldr-theme="dark" style={{ backgroundColor: darkSurface.value, padding: '1rem' }}>
      <ColorRoleField {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const darkSwatch = canvasElement.querySelector<HTMLElement>(
      '[data-color-role-swatch="surface"]',
    );
    if (darkSwatch === null) {
      throw new Error('The dark page theme must render its active surface swatch.');
    }

    const expectedLightSwatch = canvasElement.ownerDocument.createElement('span');
    expectedLightSwatch.style.backgroundColor = lightSurface.value;
    const expectedDarkSwatch = canvasElement.ownerDocument.createElement('span');
    expectedDarkSwatch.style.backgroundColor = darkSurface.value;

    await expect(expectedDarkSwatch.style.backgroundColor).not.toBe(
      expectedLightSwatch.style.backgroundColor,
    );
    await expect(darkSwatch.style.backgroundColor).toBe(expectedDarkSwatch.style.backgroundColor);
    await expect(darkSwatch.style.backgroundColor).not.toBe(
      expectedLightSwatch.style.backgroundColor,
    );
  },
};
