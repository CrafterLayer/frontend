import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { swatchContrast } from '../../model/page-plan-draft';
import type { Locale, PlanDirectionView, SwatchRole } from '../../model/view-types';
import { dentalDraft } from '../../testing/wp-13-decisions-fixtures';

import { SwatchPopover } from './SwatchPopover';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root, tall enough for the
 * popover to open under its swatch. The swatch sits on a card's Sheet, where it lives.
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        minBlockSize: 280,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div style={{ padding: 'var(--bldr-space-3xl)' }}>
        <div
          style={{
            padding: 'var(--bldr-space-xl)',
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
            borderRadius: 'var(--bldr-radius-lg)',
            background: 'var(--bldr-surface)',
          }}
        >
          <Story />
        </div>
      </div>
    </div>
  );
};

function withColour(view: PlanDirectionView, role: SwatchRole, hex: string): PlanDirectionView {
  return {
    ...view,
    swatches: (view.swatches ?? []).map((swatch) =>
      swatch.role === role ? { role, hex } : swatch,
    ),
  };
}

/** One swatch of the dental plan, judged by the engine's gate, applying what it accepts. */
function Live({
  locale,
  role,
  held,
}: {
  readonly locale: Locale;
  readonly role: SwatchRole;
  readonly held?: string | undefined;
}) {
  const [direction, setDirection] = useState(() => {
    const base = dentalDraft(locale).direction as PlanDirectionView;
    return held === undefined ? base : withColour(base, role, held);
  });
  const hex = direction.swatches?.find((swatch) => swatch.role === role)?.hex ?? '#000000';
  return (
    <SwatchPopover
      locale={locale}
      role={role}
      hex={hex}
      judge={(candidate) => swatchContrast(withColour(direction, role, candidate), role)}
      onChange={(next) => {
        setDirection((current) => withColour(current, role, next));
      }}
    />
  );
}

const meta = {
  title: 'Agent/Decisions/SwatchPopover',
  component: SwatchPopover,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    role: 'text',
    hex: '#0e1116',
    judge: () => null,
    onChange: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof SwatchPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

function story(role: SwatchRole, frame: Frame = {}, held?: string): Story {
  const locale = frame.locale ?? 'en';
  return {
    render: () => <Live locale={locale} role={role} held={held} />,
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    parameters: { panel: frame },
  };
}

const openIt = async (canvasElement: HTMLElement, name: string | RegExp) => {
  await userEvent.click(within(canvasElement).getByRole('button', { name }));
};

/** At rest: a 20px chip in a 32px target, inside the content-outline ring. */
export const Closed: Story = story('text');

/** Open: the role, the native picker, the hex field (focused), the verdict. */
export const Open: Story = {
  ...story('text'),
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, /^Text:/u);
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('textbox', { name: 'Hex code' })).toHaveFocus();
  },
};
export const OpenDark: Story = {
  ...story('text', { theme: 'dark' }),
  play: Open.play,
};
export const OpenRightToLeft: Story = {
  ...story('text', { locale: 'ar' }),
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, /^النص:/u);
  },
};

/** A grey the text cannot be read in: the verdict turns Amber, and the colour is refused. */
export const RefusesUnreadable: Story = {
  ...story('text'),
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, /^Text:/u);
    const body = within(canvasElement.ownerDocument.body);
    const field = body.getByRole('textbox', { name: 'Hex code' });
    await userEvent.clear(field);
    await userEvent.type(field, '#c8ccd4{Enter}');
    await expect(
      body.getByText("This colour isn't applied while the text can't be read."),
    ).toBeInTheDocument();
    await expect(
      within(canvasElement).getByRole('button', { name: /^Text:/u }),
    ).toHaveAccessibleName('Text: #0E1116. Change');
  },
};
export const RefusesUnreadableRightToLeftDark: Story = {
  ...story('text', { locale: 'ar', theme: 'dark' }),
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, /^النص:/u);
    const body = within(canvasElement.ownerDocument.body);
    const field = body.getByRole('textbox', { name: 'رمز اللون' });
    await userEvent.clear(field);
    await userEvent.type(field, '#c8ccd4');
  },
};

/** Text on the accent is judged against the accent. */
export const TextOnAccent: Story = {
  ...story('onAccent'),
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, /^Text on accent:/u);
  },
};

/** A held colour that fails its pair (a plan that arrived that way): the Amber flag. */
export const HeldUnreadable: Story = story('text', {}, '#c8ccd4');
export const HeldUnreadableDark: Story = story('text', { theme: 'dark' }, '#c8ccd4');
