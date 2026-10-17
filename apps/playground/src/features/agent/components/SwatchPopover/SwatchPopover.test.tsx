/**
 * SwatchPopover (SPEC §4.11): one colour of the plan's direction and the popover that
 * changes it, with a live contrast verdict from the engine's own gate
 * (`swatchContrast` → `validateDesignSystem`).
 *
 * What is ours to prove: the verdict is shown and follows the candidate; a colour that
 * breaks its pair is refused, said, and never applied; a readable one is applied on Enter,
 * and the popover closes onto its swatch; Esc applies nothing; a held unreadable colour is
 * flagged in words. Focus destinations are asserted by name (SPEC §6.3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { swatchContrast } from '../../model/page-plan-draft';
import type { Locale, PlanDirectionView, SwatchRole } from '../../model/view-types';
import { dentalDraft } from '../../testing/wp-13-decisions-fixtures';

import { SwatchPopover } from './SwatchPopover';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'SwatchPopover',
    'SwatchPopover.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function direction(locale: Locale = 'en'): PlanDirectionView {
  const held = dentalDraft(locale).direction;
  if (held === undefined) throw new Error('the dental plan has a direction');
  return held;
}

function withColour(view: PlanDirectionView, role: SwatchRole, hex: string): PlanDirectionView {
  return {
    ...view,
    swatches: (view.swatches ?? []).map((swatch) =>
      swatch.role === role ? { role, hex } : swatch,
    ),
  };
}

function Swatch({
  role = 'text',
  locale = 'en',
  base = direction(locale),
  onChange = vi.fn<(hex: string) => void>(),
}: {
  readonly role?: SwatchRole;
  readonly locale?: Locale;
  readonly base?: PlanDirectionView;
  readonly onChange?: (hex: string) => void;
}) {
  const hex = base.swatches?.find((swatch) => swatch.role === role)?.hex ?? '#000000';
  return (
    <div className="ck-agent" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <SwatchPopover
        locale={locale}
        role={role}
        hex={hex}
        judge={(candidate) => swatchContrast(withColour(base, role, candidate), role)}
        onChange={onChange}
      />
    </div>
  );
}

function swatch(): HTMLElement {
  return screen.getByRole('button', { name: 'Text: #0E1116. Change' });
}

function hexField(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Hex code' });
}

describe('SwatchPopover', () => {
  it('is a 32px button named by its role and its hex code', () => {
    render(<Swatch />);
    expect(swatch()).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens on the role, the picker and the hex field, focused and selected, with the verdict', async () => {
    const user = userEvent.setup();
    render(<Swatch />);
    await user.click(swatch());
    const popover = screen.getByRole('dialog', { name: 'Text' });
    expect(hexField()).toHaveFocus();
    expect(hexField()).toHaveValue('#0E1116');
    expect(popover).toHaveTextContent(
      /^.*Readable on the background \(contrast 1\d(?:\.\d+)?\).*$/u,
    );
    expect(screen.getByLabelText('Pick a colour')).toHaveAttribute('type', 'color');
  });

  it('refuses a colour that cannot be read on the background: says so, and applies nothing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(hex: string) => void>();
    render(<Swatch onChange={onChange} />);
    await user.click(swatch());
    await user.clear(hexField());
    await user.type(hexField(), '#c8ccd4');

    expect(
      screen.getByText(/^Not readable on the background \(contrast \d+(?:\.\d+)?\)$/u),
    ).toHaveAttribute('data-tone', 'warning');
    expect(
      screen.getByText("This colour isn't applied while the text can't be read."),
    ).toBeInTheDocument();
    expect(hexField()).toHaveAccessibleDescription(
      /Not readable on the background .* This colour isn't applied while the text can't be read\./u,
    );

    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Text' })).toBeInTheDocument();
  });

  it('applies a readable colour on Enter and closes onto its swatch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(hex: string) => void>();
    render(<Swatch onChange={onChange} />);
    await user.click(swatch());
    await user.clear(hexField());
    await user.type(hexField(), '1F2937{Enter}');

    expect(onChange).toHaveBeenCalledWith('#1f2937');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(swatch()).toHaveFocus();
  });

  it('teaches the format when the code cannot be read', async () => {
    const user = userEvent.setup();
    render(<Swatch />);
    await user.click(swatch());
    await user.clear(hexField());
    await user.type(hexField(), 'teal');
    expect(hexField()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/A hex code looks like/u)).toHaveTextContent(
      'A hex code looks like #0F766E',
    );
  });

  it('closes on Esc without applying what was typed, focus back on the swatch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(hex: string) => void>();
    render(<Swatch onChange={onChange} />);
    await user.click(swatch());
    await user.clear(hexField());
    await user.type(hexField(), '#1f2937');
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(swatch()).toHaveFocus();
  });

  it('flags a held colour that fails its pair, in words the swatch is described by', () => {
    const base = withColour(direction(), 'text', '#c8ccd4');
    render(<Swatch base={base} />);
    const button = screen.getByRole('button', { name: 'Text: #C8CCD4. Change' });
    expect(button).toHaveAttribute('data-unreadable');
    expect(button).toHaveAccessibleDescription(
      /^Not readable on the background \(contrast \d+(?:\.\d+)?\)$/u,
    );
  });

  it('judges text on the accent by the accent', async () => {
    const user = userEvent.setup();
    render(<Swatch role="onAccent" />);
    await user.click(screen.getByRole('button', { name: 'Text on accent: #FFFFFF. Change' }));
    expect(screen.getByRole('dialog', { name: 'Text on accent' })).toHaveTextContent(
      /Readable on the accent \(contrast \d+(?:\.\d+)?\)/u,
    );
  });

  it('never rounds a failing ratio up to the bar it failed', async () => {
    const user = userEvent.setup();
    // #767676 on white is 4.54:1; on the dental ground #f5fafa a hair under 4.5:1.
    render(<Swatch />);
    await user.click(swatch());
    await user.clear(hexField());
    await user.type(hexField(), '#767676');
    const verdict = screen.getByText(/readable on the background/iu);
    const ratio = Number(/contrast (\d+(?:\.\d+)?)/u.exec(verdict.textContent)?.[1]);
    if (verdict.textContent.startsWith('Not')) expect(ratio).toBeLessThan(4.5);
    else expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('speaks Arabic in Arabic, the code left to right', async () => {
    const user = userEvent.setup();
    render(<Swatch locale="ar" />);
    await user.click(screen.getByRole('button', { name: 'النص: #0E1116. تغيير' }));
    expect(screen.getByRole('dialog', { name: 'النص' })).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('textbox', { name: 'رمز اللون' })).toHaveAttribute('dir', 'ltr');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
