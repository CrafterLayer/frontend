/**
 * ComposerToolbar (SPEC §4.17, §2.3): Mode ▾ and Model ▾ at the start; ✨ Improve, `[@]`
 * and the Send slot at the end. Ours to prove: the order a request is made in, that a
 * control with nothing to offer is absent (one model, no rewriting) rather than dead, that
 * each control calls its own callback, and the 32/44px, 4/8px sizing on the stylesheet.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { MODEL } from '../../testing/wp-14-composer-fixtures';

import { ComposerToolbar } from './ComposerToolbar';

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
    'ComposerToolbar',
    'ComposerToolbar.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

type Props = ComponentProps<typeof ComposerToolbar>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    locale: 'en',
    mode: 'auto',
    model: MODEL,
    send: 'idle-ready',
    enhancement: { status: 'idle' },
    running: false,
    onModeChange: vi.fn(),
    onModelChange: vi.fn(),
    onMention: vi.fn(),
    onEnhance: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  };
}

function names(): (string | null)[] {
  return screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'));
}

describe('ComposerToolbar', () => {
  it('changes the build pool independently and locks it during a live run', async () => {
    const user = userEvent.setup();
    const onWorkersChange = vi.fn();
    const given = props({ workers: 3, onWorkersChange });
    const { rerender } = render(<ComposerToolbar {...given} />);
    const pool = screen.getByRole('combobox', { name: t('en', 'workers.label') });
    expect(pool).toHaveValue('3');
    await user.selectOptions(pool, '6');
    expect(onWorkersChange).toHaveBeenLastCalledWith(6);
    rerender(<ComposerToolbar {...given} running />);
    expect(pool).toBeDisabled();
    await user.selectOptions(pool, '1');
    expect(onWorkersChange).toHaveBeenCalledTimes(1);
  });

  it('omits the pool when the host does not provide worker selection', () => {
    render(<ComposerToolbar {...props()} />);
    expect(screen.queryByRole('combobox', { name: t('en', 'workers.label') })).toBeNull();
  });

  it('preserves the full accessible model name beside effort even when its visual label is bounded', () => {
    const name = 'Professional design and code model 550B';
    render(
      <ComposerToolbar
        {...props({
          model: {
            selected: { ...MODEL.selected, product: name },
            options: [
              { ...MODEL.selected, product: name },
              { ...MODEL.selected, id: 'comparison-model', product: 'Alternate model' },
            ],
          },
          effort: { selected: 'high', options: ['low', 'medium', 'high', 'xhigh', 'max'] },
          onEffortChange: vi.fn(),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: `Model: ${name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thinking: High' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('reads in the order a request is made: mode, model, ✨, @, Send', () => {
    render(<ComposerToolbar {...props()} />);
    expect(names()).toEqual([
      'Mode: Auto',
      'Model: Fast',
      t('en', 'enhance.button'),
      t('en', 'mention.button'),
      'Send',
    ]);
  });

  it('keeps the same order in Arabic; the direction mirrors it, not the markup', () => {
    render(<ComposerToolbar {...props({ locale: 'ar' })} />);
    expect(names()).toEqual([
      t('ar', 'mode.aria', { mode: t('ar', 'mode.auto') }),
      t('ar', 'model.aria', { name: t('ar', 'model.fast') }),
      t('ar', 'enhance.button'),
      t('ar', 'mention.button'),
      t('ar', 'send'),
    ]);
  });

  it('draws no model menu when the provider offers one model', () => {
    render(<ComposerToolbar {...props({ model: null })} />);
    expect(screen.queryByRole('button', { name: /Model/u })).toBeNull();
  });

  it('draws no ✨ where the provider cannot rewrite', () => {
    render(<ComposerToolbar {...props({ enhancement: { status: 'unavailable' } })} />);
    expect(screen.queryByRole('button', { name: t('en', 'enhance.button') })).toBeNull();
  });

  it('holds ✨ back on an empty draft and while running, with the reason', () => {
    const { rerender } = render(<ComposerToolbar {...props({ send: 'idle-empty' })} />);
    expect(
      screen.getByRole('button', { name: t('en', 'enhance.button') }),
    ).toHaveAccessibleDescription(t('en', 'enhance.empty'));
    rerender(<ComposerToolbar {...props({ send: 'running-ready', running: true })} />);
    expect(
      screen.getByRole('button', { name: t('en', 'enhance.button') }),
    ).toHaveAccessibleDescription(t('en', 'enhance.busy'));
  });

  it('calls each control’s own callback', async () => {
    const user = userEvent.setup();
    const given = props();
    render(<ComposerToolbar {...given} />);
    await user.click(screen.getByRole('button', { name: t('en', 'mention.button') }));
    await user.click(screen.getByRole('button', { name: t('en', 'enhance.button') }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(given.onMention).toHaveBeenCalledTimes(1);
    expect(given.onEnhance).toHaveBeenCalledTimes(1);
    expect(given.onSend).toHaveBeenCalledTimes(1);
  });

  it('draws no free-code switch where the host keeps none', () => {
    render(<ComposerToolbar {...props()} />);
    expect(screen.queryByRole('button', { name: t('en', 'freeCode.button') })).toBeNull();
  });

  it('shows the free-code switch as pressed when on and asks for the opposite on a press', async () => {
    const user = userEvent.setup();
    const onFreeCodeChange = vi.fn();
    const { rerender } = render(
      <ComposerToolbar {...props({ freeCode: { enabled: false }, onFreeCodeChange })} />,
    );
    const off = screen.getByRole('button', { name: t('en', 'freeCode.button') });
    expect(off).toHaveAttribute('aria-pressed', 'false');
    await user.click(off);
    expect(onFreeCodeChange).toHaveBeenLastCalledWith(true);

    rerender(<ComposerToolbar {...props({ freeCode: { enabled: true }, onFreeCodeChange })} />);
    const on = screen.getByRole('button', { name: t('en', 'freeCode.button') });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    await user.click(on);
    expect(onFreeCodeChange).toHaveBeenLastCalledWith(false);
  });

  it('is never disabled for the mode while a run is live', () => {
    render(<ComposerToolbar {...props({ running: true, send: 'running-empty' })} />);
    const mode = screen.getByRole('button', { name: 'Mode: Auto' });
    expect(mode).toBeEnabled();
    expect(mode).not.toHaveAttribute('aria-disabled');
  });

  it('spaces items 4px apart, 8px under a coarse pointer, and wraps rather than clip', () => {
    expect(CSS).toMatch(/gap:\s*var\(--ck-agent-toolbar-gap,\s*var\(--bldr-space-xs\)\)/u);
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-toolbar\s*\{\s*--ck-agent-target:\s*var\(--bldr-hit-target-min\);\s*--ck-agent-toolbar-gap:\s*var\(--bldr-space-md\)/u,
    );
    expect(CSS).toMatch(/flex-wrap:\s*wrap/u);
  });
});
