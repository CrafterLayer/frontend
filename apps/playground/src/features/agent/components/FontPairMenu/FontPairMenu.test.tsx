/**
 * FontPairMenu (SPEC §4.11): the plan's font pair, from a short curated list of
 * Arabic-capable pairs.
 *
 * What is ours to prove: the menu offers ONLY faces the engine has verified. The engine is
 * the judge, through its public API: every pair the menu offers, set on a real plan, passes
 * the engine's own `validatePagePlan` on an Arabic page and on an English one, and a face
 * the engine never verified is refused by the same validator (so the check has teeth).
 * When the engine exports its verified families, a pair naming any other face is left out.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validatePagePlan } from '@craftkit/builder';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { applyPlanOp, FONT_PAIRS, toEnginePagePlan } from '../../model/page-plan-draft';
import type { Locale } from '../../model/view-types';
import { dentalDraft, dentalPlanCandidate } from '../../testing/wp-13-decisions-fixtures';

import { FontPairMenu } from './FontPairMenu';
import { engineVerifiedFamilies, verifiedPairs } from './verified-pairs';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'FontPairMenu', 'FontPairMenu.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const SELECTED = 'reem-kufi--ibm-plex-sans-arabic';

function trigger(name = 'Fonts: Reem Kufi / IBM Plex Sans Arabic'): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('FontPairMenu', () => {
  it('names the whole pair on its trigger, and announces a menu', () => {
    render(<FontPairMenu locale="en" selectedId={SELECTED} onSelect={vi.fn()} />);
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('lists the curated pairs as radio items, the plan’s pair checked', async () => {
    const user = userEvent.setup();
    render(<FontPairMenu locale="en" selectedId={SELECTED} onSelect={vi.fn()} />);
    await user.click(trigger());
    const menu = screen.getByRole('menu', { name: 'Fonts: Reem Kufi / IBM Plex Sans Arabic' });
    const items = within(within(menu).getByRole('group', { name: 'Fonts' })).getAllByRole(
      'menuitemradio',
    );
    expect(items).toHaveLength(verifiedPairs().length);
    const checked = items.filter((item) => item.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('Reem Kufi');
    expect(checked[0]).toHaveTextContent('IBM Plex Sans Arabic');
  });

  it('chooses a pair by its id, and ignores the pair already chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(pairId: string) => void>();
    render(<FontPairMenu locale="en" selectedId={SELECTED} onSelect={onSelect} />);
    await user.click(trigger());
    await user.click(screen.getByRole('menuitemradio', { name: /^El Messiri\s*Almarai$/u }));
    expect(onSelect).toHaveBeenCalledWith('el-messiri--almarai');

    await user.click(trigger());
    await user.click(
      screen.getByRole('menuitemradio', { name: /^Reem Kufi\s*IBM Plex Sans Arabic$/u }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('returns focus to its trigger when the menu closes (SPEC §6.3)', async () => {
    const user = userEvent.setup();
    render(<FontPairMenu locale="en" selectedId={SELECTED} onSelect={vi.fn()} />);
    await user.click(trigger());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('shows faces that are not a curated pair by name', () => {
    render(<FontPairMenu locale="en" fonts="Cairo / Tajawal" onSelect={vi.fn()} />);
    expect(trigger('Fonts: Cairo / Tajawal')).toBeInTheDocument();
  });

  it('speaks Arabic in Arabic', () => {
    render(<FontPairMenu locale="ar" selectedId={SELECTED} onSelect={vi.fn()} />);
    expect(trigger('الخطوط: Reem Kufi / IBM Plex Sans Arabic')).toBeInTheDocument();
  });

  describe('only the engine’s verified faces', () => {
    it.each<Locale>(['ar', 'en'])(
      'every offered pair builds: the engine’s validatePagePlan accepts it on a %s page',
      (locale) => {
        const draft = dentalDraft(locale);
        for (const pair of verifiedPairs()) {
          const next =
            draft.direction?.fontPairId === pair.id
              ? draft
              : applyPlanOp(draft, { kind: 'setFonts', pairId: pair.id });
          const result = toEnginePagePlan(next);
          expect(result?.ok, `${pair.id} on ${locale}`).toBe(true);
          if (result?.ok === true) {
            expect(result.plan.tokens.fontDisplay.family).toBe(pair.heading);
            expect(result.plan.tokens.fontBody.family).toBe(pair.body);
          }
        }
      },
    );

    it('the same validator refuses a face the engine never verified', () => {
      const candidate = dentalPlanCandidate('ar');
      const tokens = candidate['tokens'] as Record<string, unknown>;
      const result = validatePagePlan(
        {
          ...candidate,
          tokens: { ...tokens, fontDisplay: { family: 'Comic Sans MS', weights: [400] } },
        },
        { intent: 'replace' },
      );
      expect(result.ok).toBe(false);
    });

    it('leaves out a pair naming a face outside the engine’s verified list', () => {
      const verified = new Set(['Reem Kufi', 'IBM Plex Sans Arabic', 'El Messiri', 'Almarai']);
      expect(verifiedPairs(FONT_PAIRS, verified).map((pair) => pair.id)).toEqual([
        'reem-kufi--ibm-plex-sans-arabic',
        'el-messiri--almarai',
        'ibm-plex-sans-arabic',
      ]);
    });

    it('reads the verified families off the engine’s public API when it exports them', () => {
      expect(engineVerifiedFamilies({})).toBeNull();
      expect(
        engineVerifiedFamilies({ VERIFIED_FONT_FAMILIES: { Cairo: {}, Tajawal: {} } }),
      ).toEqual(new Set(['Cairo', 'Tajawal']));
    });

    it('offers nothing it cannot show: no menu at all when no pair survives', () => {
      const { container } = render(
        <FontPairMenu locale="en" options={[]} selectedId={SELECTED} onSelect={vi.fn()} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
