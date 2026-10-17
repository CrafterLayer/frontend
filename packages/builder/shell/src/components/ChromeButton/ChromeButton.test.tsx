import { createRef } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChromeButton, type ChromeButtonProps } from './ChromeButton';

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'ChromeButton', 'ChromeButton.css'),
  'utf8',
);

afterEach(cleanup);

describe('ChromeButton', () => {
  it('defaults to the quiet chrome action at the lg theme size', () => {
    render(<ChromeButton>Open panel</ChromeButton>);

    const button = screen.getByRole('button', { name: 'Open panel' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('data-bldr-chrome-button', '');
    expect(button).toHaveAttribute('data-size', 'lg');
    expect(button).toHaveAttribute('data-variant', 'quiet');
  });

  it('preserves native click, Enter, Space, focus, ref, and disabled behavior', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <ChromeButton ref={ref} variant="primary" onClick={onClick}>
        Publish
      </ChromeButton>,
    );
    const button = screen.getByRole('button', { name: 'Publish' });

    expect(ref.current).toBe(button);
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);

    rerender(
      <ChromeButton disabled ref={ref} variant="primary" onClick={onClick}>
        Publish
      </ChromeButton>,
    );
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('gives icon-only chrome an explicit accessible name', () => {
    render(
      <ChromeButton variant="icon" aria-label="Undo">
        <svg aria-hidden="true" />
      </ChromeButton>,
    );

    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveAccessibleName('Undo');
    expect(button).toHaveAttribute('data-tone', 'quiet');
  });

  it('rejects an icon-only button without an accessible name at compile time', () => {
    const acceptChromeButtonProps = (props: ChromeButtonProps) => props;
    const namedIcon = {
      variant: 'icon',
      'aria-label': 'Redo',
      children: <svg aria-hidden="true" />,
    } satisfies ChromeButtonProps;

    // @ts-expect-error -- the icon discriminant requires an accessible name.
    acceptChromeButtonProps({ variant: 'icon', children: <span /> });

    expect(namedIcon['aria-label']).toBe('Redo');
  });

  it('keeps toggle semantics and aria-pressed on the native button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(
      <ChromeButton variant="toggle" aria-pressed={false} onClick={onClick}>
        Bold
      </ChromeButton>,
    );
    const toggle = screen.getByRole('button', { name: 'Bold' });

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <ChromeButton variant="toggle" aria-pressed onClick={onClick}>
        Bold
      </ChromeButton>,
    );
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).not.toHaveAttribute('role', 'link');
  });

  it('uses the shared focus tokens and only the declared size tokens', () => {
    expect(CSS_SOURCE).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*var\(--bldr-focus-ring-width\) solid var\(--bldr-focus-ring\);[^}]*outline-offset:\s*var\(--bldr-focus-ring-offset\);/su,
    );
    for (const token of ['control-sm', 'control-lg', 'hit-target-min']) {
      expect(CSS_SOURCE).toContain(`var(--bldr-${token})`);
    }
  });

  it('draws a tooltip without changing the accessible name, and none when there is no text', () => {
    const { rerender } = render(
      <ChromeButton variant="icon" aria-label="Undo" tooltip="Undo · Ctrl Z">
        <span aria-hidden="true">↶</span>
      </ChromeButton>,
    );
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toHaveAttribute('data-bldr-tooltip', 'Undo · Ctrl Z');

    rerender(
      <ChromeButton variant="icon" aria-label="Undo" tooltip="">
        <span aria-hidden="true">↶</span>
      </ChromeButton>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveAttribute('data-bldr-tooltip');
    // The hint shows on keyboard focus as well as on hover.
    expect(CSS_SOURCE).toMatch(/\[data-bldr-tooltip\]:focus-visible::after/u);
  });
});
