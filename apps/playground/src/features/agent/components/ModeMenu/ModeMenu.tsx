import { t, type Key } from '../../copy';
import { ASSISTANT_MODES } from '../../model/modes';
import type { AssistantMode, Locale } from '../../model/view-types';
import { ChoiceMenu, type ChoiceOption } from '../ComposerToolbar/ChoiceMenu';

import './ModeMenu.css';

export interface ModeMenuProps {
  readonly locale: Locale;
  readonly mode: AssistantMode;
  /**
   * A run is live. The menu stays enabled (SPEC §4.17: a mode chosen now applies to the
   * **next** request, and the running one keeps the authority it started with); its
   * tooltip says so.
   */
  readonly running: boolean;
  readonly onModeChange: (mode: AssistantMode) => void;
}

const NAME_KEY = {
  auto: 'mode.auto',
  ask: 'mode.ask',
  plan: 'mode.plan',
} as const satisfies Readonly<Record<AssistantMode, Key>>;

const DESCRIPTION_KEY = {
  auto: 'mode.auto.desc',
  ask: 'mode.ask.desc',
  plan: 'mode.plan.desc',
} as const satisfies Readonly<Record<AssistantMode, Key>>;

/**
 * How eagerly a request may touch the page (SPEC §4.17 ModeMenu): Auto, Ask first, Plan,
 * as a radio menu of two-line items, each saying what it will and will not do to the page.
 *
 * The trigger reads the mode's name ("Auto ▾") and is named "Mode: Auto". Its words come
 * from the catalog (`mode.*`), never from `model/modes.ts`, which carries none.
 */
export function ModeMenu({ locale, mode, running, onModeChange }: ModeMenuProps) {
  const name = t(locale, NAME_KEY[mode]);
  const options: readonly ChoiceOption<AssistantMode>[] = ASSISTANT_MODES.map((value) => ({
    value,
    name: t(locale, NAME_KEY[value]),
    description: t(locale, DESCRIPTION_KEY[value]),
  }));
  return (
    <ChoiceMenu
      locale={locale}
      label={name}
      ariaLabel={t(locale, 'mode.aria', { mode: name })}
      options={options}
      value={mode}
      onValueChange={onModeChange}
      tooltip={running ? t(locale, 'mode.running') : undefined}
      className="ck-agent-mode"
      icon="bolt"
    />
  );
}
