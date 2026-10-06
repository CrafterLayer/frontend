import { t, type Key } from '../../copy';
import type { EffortLevel, EffortSelectionView, Locale } from '../../model/view-types';
import { ChoiceMenu, type ChoiceOption } from '../ComposerToolbar/ChoiceMenu';

export interface EffortMenuProps {
  readonly locale: Locale;
  /** The picker (`AgentViewState.effort`); the toolbar draws no EffortMenu when it is `null`. */
  readonly effort: EffortSelectionView;
  readonly onEffortChange: (level: EffortLevel) => void;
}

const NAME_KEY = {
  low: 'effort.low',
  medium: 'effort.medium',
  high: 'effort.high',
  xhigh: 'effort.xhigh',
  max: 'effort.max',
} as const satisfies Readonly<Record<EffortLevel, Key>>;

const TRAIT_KEY = {
  low: 'effort.low.trait',
  medium: 'effort.medium.trait',
  high: 'effort.high.trait',
  xhigh: 'effort.xhigh.trait',
  max: 'effort.max.trait',
} as const satisfies Readonly<Record<EffortLevel, Key>>;

/**
 * How long the model may think (the effort menu): Low … Max, `Medium` by default. It sits
 * beside the ModelMenu and reads the same way: the level's name on line one, what choosing
 * it costs the person (time, money) on line two. A level changed during a run applies to
 * the next request, as a mode does.
 */
export function EffortMenu({ locale, effort, onEffortChange }: EffortMenuProps) {
  const name = t(locale, NAME_KEY[effort.selected]);
  const options: readonly ChoiceOption<EffortLevel>[] = effort.options.map((level) => ({
    value: level,
    name: t(locale, NAME_KEY[level]),
    description: t(locale, TRAIT_KEY[level]),
  }));
  return (
    <ChoiceMenu
      locale={locale}
      label={name}
      ariaLabel={t(locale, 'effort.aria', { level: name })}
      options={options}
      value={effort.selected}
      onValueChange={onEffortChange}
      className="ck-agent-effort"
    />
  );
}
