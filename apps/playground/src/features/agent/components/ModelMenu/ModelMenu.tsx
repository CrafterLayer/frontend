import { t, type Key } from '../../copy';
import type { Locale, ModelSelectionView, ModelTier } from '../../model/view-types';
import { ChoiceMenu, type ChoiceOption } from '../ComposerToolbar/ChoiceMenu';

import './ModelMenu.css';

export interface ModelMenuProps {
  readonly locale: Locale;
  /** The picker (`AgentViewState.model`); the toolbar draws no ModelMenu when it is `null`. */
  readonly model: ModelSelectionView;
  /** Receives the raw id, which is never drawn (`AgentController.setModel`). */
  readonly onModelChange: (id: string) => void;
}

const TIER_KEY = {
  fast: 'model.fast',
  careful: 'model.careful',
  free: 'model.free',
} as const satisfies Readonly<Record<ModelTier, Key>>;

const TRAIT_KEY = {
  fast: 'model.fast.trait',
  careful: 'model.careful.trait',
  free: 'model.free.trait',
} as const satisfies Readonly<Record<ModelTier, Key>>;

/**
 * Which model writes (SPEC §4.17 ModelMenu), by what the choice means for the person: its
 * tier («سريع» / "Fast", «دقيق» / "Careful", «مجاني» / "Free") on line one with the vendor's
 * product name at its end in `<bdi>`, and the tier's trait on line two.
 *
 * A raw model id is never shown (`model-label.ts` maps each id to a tier and a product);
 * it is only what `onModelChange` receives. An id that carries no name reads by its tier
 * alone. The trigger reads the tier and cuts at 10 characters.
 */
export function ModelMenu({ locale, model, onModelChange }: ModelMenuProps) {
  const name = t(locale, TIER_KEY[model.selected.tier]);
  const options: readonly ChoiceOption<string>[] = model.options.map((option) => ({
    value: option.id,
    name: t(locale, TIER_KEY[option.tier]),
    detail: option.product === '' ? undefined : option.product,
    description: t(locale, TRAIT_KEY[option.tier]),
  }));
  return (
    <ChoiceMenu
      locale={locale}
      label={name}
      ariaLabel={t(locale, 'model.aria', { name })}
      options={options}
      value={model.selected.id}
      onValueChange={onModelChange}
      className="ck-agent-model"
    />
  );
}
