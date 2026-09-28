import { ChromeButton } from '@craftkit/builder';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';

import type { Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { usePortalScope } from '../IconButton';

import './ChoiceMenu.css';
import { ComposerTooltip } from './ComposerTooltip';

/** One choice in a ChoiceMenu. */
export interface ChoiceOption<V extends string> {
  /** What `onValueChange` receives. Never drawn: a model's raw id stays out of sight. */
  readonly value: V;
  /** Line one, in Read 600: the choice's name ("Ask first", "Fast"). */
  readonly name: string;
  /** At the end of line one, in `<bdi>`: the vendor's product name ("Haiku"). */
  readonly detail?: string | undefined;
  /** Line two, in Meta: what choosing it means. */
  readonly description: string;
}

export interface ChoiceMenuProps<V extends string> {
  readonly locale: Locale;
  /** The trigger's visible word: the current choice's name. */
  readonly label: string;
  /** The trigger's accessible name ("Mode: Auto"). It contains `label` (WCAG 2.5.3). */
  readonly ariaLabel: string;
  readonly options: readonly ChoiceOption<V>[];
  readonly value: V;
  readonly onValueChange: (value: V) => void;
  /** A tooltip for the trigger (`mode.running` while a run is live); none when left out. */
  readonly tooltip?: string | undefined;
  /** Appended to the trigger's class `ck-agent-choice`. */
  readonly className?: string | undefined;
}

/** How a list of words is joined for a screen reader, in the locale's punctuation. */
const COMMA: Readonly<Record<Locale, string>> = { ar: '، ', en: ', ' };

/**
 * The composer's radio menus (SPEC §4.17 ModeMenu, ModelMenu): a ghost trigger that reads
 * the current choice with a ▾, opening a Radix DropdownMenu radio group of two-line items.
 * The selected item carries the check and the Mist fill; its second line turns Graphite,
 * because Slate on Mist is forbidden (SPEC §2.1 rule 2).
 *
 * The keyboard map is the platform's (SPEC §6.7): Enter, Space or ↑ ↓ open it, ↑ ↓ move and
 * wrap, Home and End jump, a letter finds an item, Esc closes it and focus returns to the
 * trigger. It opens upwards from the composer, inside the panel (the portal scope), in the
 * panel's direction, theme and Arabic type.
 *
 * The trigger is never disabled: a mode changed during a run applies to the next request,
 * and says so in its tooltip.
 */
export function ChoiceMenu<V extends string>({
  locale,
  label,
  ariaLabel,
  options,
  value,
  onValueChange,
  tooltip,
  className,
}: ChoiceMenuProps<V>) {
  const { scope, capture } = usePortalScope();
  const [open, setOpen] = useState(false);
  // The menu opens on pointerdown or a key: read its portal scope first.
  const captureScope = (
    event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    capture(event.currentTarget);
  };

  return (
    <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <ComposerTooltip
          label={tooltip ?? ariaLabel}
          // Always mounted, so the trigger is one element for its whole life; it speaks
          // only when there is something to add, and never over its own open menu.
          silent={tooltip === undefined || open}
          align="start"
        >
          <ChromeButton
            className={className === undefined ? 'ck-agent-choice' : `ck-agent-choice ${className}`}
            size="lg"
            aria-label={ariaLabel}
            onPointerDown={captureScope}
            onKeyDown={captureScope}
          >
            <span className="ck-agent-choice__label">{label}</span>
            <AgentIcon name="chevronDown" className="ck-agent-choice__chevron" />
          </ChromeButton>
        </ComposerTooltip>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={scope.container ?? null}>
        <DropdownMenu.Content
          className="ck-agent-choices"
          side="top"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          loop
          // `dir` comes from Root, which stamps it on the content; `lang` is ours to set.
          lang={locale}
        >
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(next) => {
              const chosen = options.find((option) => option.value === next);
              if (chosen !== undefined) onValueChange(chosen.value);
            }}
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="ck-agent-choices__item"
              >
                <span className="ck-agent-choices__check">
                  <DropdownMenu.ItemIndicator>
                    <AgentIcon name="check" />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="ck-agent-choices__name">{option.name}</span>
                {option.detail === undefined ? null : (
                  <>
                    <span className="bldr-visually-hidden">{COMMA[locale]}</span>
                    <bdi className="ck-agent-choices__detail">{option.detail}</bdi>
                  </>
                )}
                <span className="bldr-visually-hidden">{COMMA[locale]}</span>
                <span className="ck-agent-choices__description">{option.description}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
