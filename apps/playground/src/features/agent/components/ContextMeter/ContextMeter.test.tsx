/**
 * ContextMeter (2026-10-12): the latest request's estimated size against its budget. Ours
 * to prove: it is a `meter` named "Context" whose value is spoken in whole tokens with
 * Latin digits in both languages; the eye reads a compact "12k / 64k" and a bar; past 80%
 * it takes the warning token and says what that means; a trimmed conversation says so; and
 * the stylesheet reads tokens only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { compactTokens, contextLabels } from '../../copy/context-labels';
import type { ContextMeterView } from '../../model/context-meter';

import { ContextMeter } from './ContextMeter';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'ContextMeter', 'ContextMeter.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

const QUIET: ContextMeterView = { used: 12_345, max: 64_000, level: 'normal', trimmed: false };
const NEAR: ContextMeterView = { used: 55_100, max: 64_000, level: 'warning', trimmed: true };

describe('ContextMeter', () => {
  it('is a meter named Context, its value spoken in whole tokens', () => {
    render(<ContextMeter locale="en" meter={QUIET} />);
    const meter = screen.getByRole('meter', { name: 'Context' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '64000');
    expect(meter).toHaveAttribute('aria-valuenow', '12345');
    expect(meter).toHaveAttribute('aria-valuetext', 'About 12,345 of 64,000 tokens');
  });

  it('shows the eye a compact figure and a bar filled to the share used', () => {
    const { container } = render(<ContextMeter locale="en" meter={QUIET} />);
    expect(screen.getByText('12k / 64k')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.ck-agent-meter__fill')?.getAttribute('style')).toContain(
      'inline-size: 19.3%',
    );
    expect(container.querySelector('.ck-agent-meter')).toHaveAttribute('data-level', 'normal');
  });

  it('speaks Arabic with Latin digits', () => {
    render(<ContextMeter locale="ar" meter={QUIET} />);
    const meter = screen.getByRole('meter', { name: 'السياق' });
    expect(meter).toHaveAttribute('aria-valuetext', 'نحو 12,345 من 64,000 توكن');
    expect(screen.getByText('12k / 64k')).toBeInTheDocument();
  });

  it('turns to the warning token past 80%, and says the conversation gave way', () => {
    const { container } = render(<ContextMeter locale="en" meter={NEAR} />);
    const meter = screen.getByRole('meter', { name: 'Context' });
    expect(meter).toHaveAttribute('data-level', 'warning');
    expect(meter).toHaveAttribute('data-trimmed');
    expect(meter.getAttribute('aria-valuetext')).toContain(contextLabels('en').meterNear);
    expect(meter.getAttribute('aria-valuetext')).toContain(contextLabels('en').trimmed);
    expect(meter.getAttribute('title')).toContain(contextLabels('en').meterHint);
    expect(container.querySelector('.ck-agent-meter__fill')?.getAttribute('style')).toContain(
      'inline-size: 86.1%',
    );
  });

  it('says the same in Arabic', () => {
    render(<ContextMeter locale="ar" meter={NEAR} />);
    const text = screen.getByRole('meter').getAttribute('aria-valuetext') ?? '';
    expect(text).toContain(contextLabels('ar').meterNear);
    expect(text).toContain(contextLabels('ar').trimmed);
  });

  it('never draws the bar past full', () => {
    const { container } = render(
      <ContextMeter
        locale="en"
        meter={{ used: 70_000, max: 64_000, level: 'warning', trimmed: false }}
      />,
    );
    expect(container.querySelector('.ck-agent-meter__fill')?.getAttribute('style')).toContain(
      'inline-size: 100%',
    );
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '64000');
  });

  it('reads only tokens, logical properties and no raw colour', () => {
    expect(CSS).toMatch(/\[data-level='warning'\][^{]*\{[^}]*var\(--bldr-warning\)/u);
    expect(CSS).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|width|height)\s*:/mu,
    );
  });
});

describe('compactTokens', () => {
  it.each([
    [0, '0'],
    [850, '850'],
    [999, '999'],
    [1_000, '1k'],
    [1_249, '1.2k'],
    [1_250, '1.3k'],
    [9_999, '10k'],
    [12_345, '12k'],
    [12_500, '13k'],
    [64_000, '64k'],
  ] as const)('%d reads %s', (tokens, shown) => {
    expect(compactTokens(tokens)).toBe(shown);
  });
});
