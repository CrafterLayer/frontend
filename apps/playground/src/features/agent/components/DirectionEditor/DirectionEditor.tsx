import { useState, type KeyboardEvent } from 'react';

import { t } from '../../copy';
import { SWATCH_ROLES, swatchContrast } from '../../model/page-plan-draft';
import { resolveDir } from '../../model/resolve-dir';
import type {
  FontPairOption,
  Locale,
  PlanDirectionView,
  PlanOp,
  SwatchRole,
} from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { FontPairMenu } from '../FontPairMenu';
import { SwatchPopover } from '../SwatchPopover';

import './DirectionEditor.css';

export interface DirectionEditorProps {
  readonly locale: Locale;
  /** The plan's structured direction: its mood, five swatches and font pair (SPEC §7.6 E7). */
  readonly direction: PlanDirectionView;
  /** A `setMood`, `setToken` or `setFonts` op (`AgentController.editPlan`). */
  readonly onEdit: (op: PlanOp) => void;
  /** The pairs FontPairMenu offers; the model's curated list by default. */
  readonly fontPairs?: readonly FontPairOption[] | undefined;
}

/**
 * The engine's limit on a plan's signature, which the card shows as its mood
 * (`validate-page-plan.ts`: `tokens.signature`, 200 characters). A longer mood would be
 * refused by the model without a word, so the field stops there instead.
 */
const MOOD_MAX_LENGTH = 200;

/** One line of prose, as a person meant it (the model tidies it the same way). */
function tidy(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/** The direction with one role's colour replaced: what a candidate is judged in. */
function withColour(
  direction: PlanDirectionView,
  role: SwatchRole,
  hex: string,
): PlanDirectionView {
  return {
    ...direction,
    swatches: (direction.swatches ?? []).map((swatch) =>
      swatch.role === role ? { role, hex } : swatch,
    ),
  };
}

/**
 * The plan's look, editable in place (SPEC §4.11 DirectionEditor): the mood line, the five
 * colours and the font pair.
 *
 * The mood is an inline text field that looks like the line it replaces: no box at rest,
 * the Wash on hover, and the Sheet with a Rule border once it is being edited. Enter or
 * leaving the field applies it; Esc puts back the mood the plan holds. An emptied field
 * applies nothing (the model restores the mood it held, as a rename does).
 *
 * The swatches follow the reading direction in the order background, surface, text,
 * accent, text on accent (SPEC §4.8), 20px in 32px targets with 12px between them; each
 * opens a SwatchPopover judged by the engine's own contrast gate. A pair that fails is
 * flagged on its swatches, and the card's Build waits (PagePlanCard says why). The font
 * pair is a FontPairMenu at the inline end of the same line.
 *
 * Components render views and call callbacks: every change leaves as a `PlanOp`.
 */
export function DirectionEditor({ locale, direction, onEdit, fontPairs }: DirectionEditorProps) {
  /** What the field holds while it is being edited; `null` shows the plan's own mood. */
  const [draft, setDraft] = useState<string | null>(null);
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';

  const apply = (text: string) => {
    const mood = tidy(text);
    if (mood !== '' && mood !== direction.mood) onEdit({ kind: 'setMood', mood });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (draft !== null) apply(draft);
      return;
    }
    // Esc restores; spent here only when there was something to restore.
    if (event.key === 'Escape' && draft !== null && draft !== direction.mood) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(direction.mood);
    }
  };

  return (
    <div className="ck-agent-direction-editor">
      <label className="ck-agent-direction-editor__mood">
        <input
          type="text"
          className="ck-agent-direction-editor__field"
          aria-label={t(locale, 'plan.mood.aria')}
          dir={resolveDir(direction.mood, uiDir)}
          autoComplete="off"
          maxLength={MOOD_MAX_LENGTH}
          value={draft ?? direction.mood}
          onFocus={() => {
            setDraft(direction.mood);
          }}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          onBlur={() => {
            if (draft !== null) apply(draft);
            setDraft(null);
          }}
          onKeyDown={onKeyDown}
        />
        <AgentIcon name="pencil" className="ck-agent-direction-editor__pencil" />
      </label>
      <div className="ck-agent-direction-editor__line">
        <div
          role="group"
          aria-label={t(locale, 'plan.colors')}
          className="ck-agent-direction-editor__swatches"
        >
          {SWATCH_ROLES.flatMap((role) => {
            const swatch = direction.swatches?.find((candidate) => candidate.role === role);
            if (swatch === undefined) return [];
            return [
              <SwatchPopover
                key={role}
                locale={locale}
                role={role}
                hex={swatch.hex}
                judge={(hex) => swatchContrast(withColour(direction, role, hex), role)}
                onChange={(hex) => {
                  onEdit({ kind: 'setToken', role, hex });
                }}
              />,
            ];
          })}
        </div>
        {direction.fonts === undefined ? null : (
          <FontPairMenu
            locale={locale}
            selectedId={direction.fontPairId}
            fonts={direction.fonts}
            options={fontPairs}
            onSelect={(pairId) => {
              onEdit({ kind: 'setFonts', pairId });
            }}
          />
        )}
      </div>
    </div>
  );
}
