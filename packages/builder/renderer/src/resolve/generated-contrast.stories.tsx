import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import {
  defaultDesignSystem,
  tokenCssName,
  type DesignPairing,
  type DesignSystem,
} from '@craftkit/builder-schema';

import { designSystemToCssVars } from './theme';

/**
 * SC-009, measured in a real browser: every pairing a generated design system
 * AUTHORIZES clears its contrast floor.
 *
 * ## Why a browser, when the ratios could be computed from the token map
 *
 * `packages/builder/theme/src/contrast.stories.tsx` computes chrome ratios from
 * hex values, and it is right to: those values are the theme. A SITE's colours
 * arrive as custom properties, and a custom property can resolve to something
 * other than what the map says — to a fallback when the name is misspelled, to
 * an inherited value when the rule never reached the element, to nothing at
 * all. Reading `getComputedStyle` is what tells those apart from a palette that
 * genuinely painted, and none of them is visible to arithmetic over the map.
 *
 * ## What "authorized" means
 *
 * Only the pairings the SYSTEM declares. A design system says which text sits
 * on which ground; measuring every colour against every other would report
 * failures for combinations the site never paints, and a gate that cries about
 * imaginary pages is one people learn to ignore.
 */

const AA_TEXT = 4.5;
const AA_LARGE = 3;

function channelsOf(colour: string): [number, number, number] {
  const parts = /rgba?\(([^)]+)\)/u.exec(colour)?.[1]?.split(',') ?? [];
  return [
    Number.parseFloat(parts[0] ?? '0'),
    Number.parseFloat(parts[1] ?? '0'),
    Number.parseFloat(parts[2] ?? '0'),
  ];
}

function luminance(colour: string): number {
  const linear = channelsOf(colour).map((channel) => {
    const scaled = channel / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const label = (pairing: DesignPairing): string =>
  `${pairing.text} on ${pairing.background} (${pairing.size})`;

function PairingBoard({ system }: { system: DesignSystem }) {
  return (
    <div>
      <style>{designSystemToCssVars(system)}</style>
      <p data-testid="system-name">{system.name}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {system.pairings.map((pairing) => (
          <li
            key={label(pairing)}
            data-testid={label(pairing)}
            data-size={pairing.size}
            style={{
              /*
                Painted through the custom property, never from the map. That is
                the whole point: what the browser resolves is what a visitor
                sees, and it is not always what the map says.
              */
              color: `var(${tokenCssName(pairing.text)})`,
              backgroundColor: `var(${tokenCssName(pairing.background)})`,
              padding: '0.5rem',
              fontSize: pairing.size === 'large' ? '1.5rem' : '1rem',
            }}
          >
            {label(pairing)}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function measure(canvasElement: HTMLElement, system: DesignSystem): Promise<void> {
  const canvas = within(canvasElement);
  const view = canvasElement.ownerDocument.defaultView;
  if (view === null) throw new Error('a real window is required to resolve custom properties');

  /* Non-vacuity: a system with no pairings would pass an empty loop forever. */
  await expect(system.pairings.length).toBeGreaterThan(3);

  for (const pairing of system.pairings) {
    const row = canvas.getByTestId(label(pairing));
    const style = view.getComputedStyle(row);
    const measured = ratio(style.color, style.backgroundColor);
    const floor = pairing.size === 'large' ? AA_LARGE : AA_TEXT;

    /*
      A transparent background means the rule never reached the element — the
      custom property resolved to nothing, and the ratio computed from it would
      be a number about a colour nobody painted.
    */
    await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(
      measured,
      `${label(pairing)} measured ${measured.toFixed(2)}:1, below ${String(floor)}:1`,
    ).toBeGreaterThanOrEqual(floor);
  }
}

const meta = {
  title: 'Renderer/GeneratedContrast',
  component: PairingBoard,
  parameters: { layout: 'padded' },
  args: { system: defaultDesignSystem() },
  argTypes: { system: { control: false } },
} satisfies Meta<typeof PairingBoard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The system every generated site starts from. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.system);
  },
};

/**
 * A system whose ACCENT was replaced — the commonest thing a generation does.
 *
 * `#0b5cff` on white measures about 5.2:1, so it clears the floor; the point of
 * the story is that the measurement happens at all when a run re-points a role.
 */
export const Recoloured: Story = {
  args: {
    system: ((): DesignSystem => {
      const base = defaultDesignSystem();
      return {
        ...base,
        name: 'Recoloured',
        tokens: { ...base.tokens, accent: '#0b5cff', accentText: '#ffffff' },
      };
    })(),
  },
  play: async ({ args, canvasElement }) => {
    await measure(canvasElement, args.system);
  },
};
