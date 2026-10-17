import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Fragment, useMemo, type KeyboardEvent, type PointerEvent } from 'react';

import { t } from '../../copy';
import type { FontPairOption, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { usePortalScope } from '../IconButton';
import '../RecordMenu/RecordMenu.css';

import './FontPairMenu.css';
import { verifiedPairs } from './verified-pairs';

export interface FontPairMenuProps {
  readonly locale: Locale;
  /** The curated pair the plan uses (`PlanDirectionView.fontPairId`), checked in the menu. */
  readonly selectedId?: string | undefined;
  /**
   * The faces the plan uses, by name (`PlanDirectionView.fonts`, "Reem Kufi / IBM Plex Sans
   * Arabic"): what the trigger shows when they are not one of the curated pairs.
   */
  readonly fonts?: string | undefined;
  /** The pairs to offer; the model's curated `FONT_PAIRS` by default. */
  readonly options?: readonly FontPairOption[] | undefined;
  readonly onSelect: (pairId: string) => void;
}

/** The pair's two faces, heading first; one face when a single family sets both. */
function facesOf(pair: Pick<FontPairOption, 'heading' | 'body'>): readonly string[] {
  return pair.heading === pair.body ? [pair.heading] : [pair.heading, pair.body];
}

/** "Heading / Body" as the model writes it, back into its faces. */
function facesOfLabel(label: string): readonly string[] {
  return label
    .split(' / ')
    .map((face) => face.trim())
    .filter((face) => face !== '');
}

/**
 * The plan's font pair (SPEC §4.11): a quiet trigger at the inline end of the swatch row
 * and a Radix DropdownMenu of curated, Arabic-capable pairs, as a radio group.
 *
 * Only pairs whose faces the engine has verified are offered (`verifiedPairs`): the menu
 * is a short list a person reads, not "any Google font", and never a face the build would
 * refuse. Each item shows the heading face over the body face; the checked one carries the
 * check glyph on Mist (SPEC §4.17 ModeMenu: "Selected = check glyph + Mist").
 *
 * The trigger shows the heading face, and from 400px the "Aa" specimen and both faces
 * (SPEC §3.14). Its accessible name is always the whole pair ("Fonts: Reem Kufi / IBM Plex
 * Sans Arabic"), which contains every word the trigger shows (WCAG 2.5.3). Face names are
 * Latin proper nouns: each sits in its own `<bdi>`, so in Arabic the heading face reads
 * first, at the right.
 */
export function FontPairMenu({ locale, selectedId, fonts, options, onSelect }: FontPairMenuProps) {
  const { scope, capture } = usePortalScope();
  const offered = useMemo(() => verifiedPairs(options), [options]);
  const selected = offered.find((pair) => pair.id === selectedId);
  const faces = selected === undefined ? facesOfLabel(fonts ?? '') : facesOf(selected);
  const label = faces.join(' / ');

  if (offered.length === 0) return null;

  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const captureScope = (
    event: PointerEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    capture(event.currentTarget);
  };

  return (
    <DropdownMenu.Root dir={dir}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="ck-agent-font-menu__trigger"
          aria-label={t(locale, 'plan.fonts.aria', { pair: label })}
          onPointerDown={captureScope}
          onKeyDown={captureScope}
        >
          <span className="ck-agent-font-menu__specimen" aria-hidden="true">
            {t(locale, 'plan.fonts.specimen')}
          </span>
          <span className="ck-agent-font-menu__faces" aria-hidden="true">
            {faces.map((face, index) => (
              <span
                key={face}
                className="ck-agent-font-menu__face"
                data-face={index === 0 ? 'heading' : 'body'}
              >
                {index === 0 ? null : <span className="ck-agent-font-menu__slash"> / </span>}
                <bdi>{face}</bdi>
              </span>
            ))}
          </span>
          <AgentIcon name="chevronDown" className="ck-agent-font-menu__chevron" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={scope.container ?? null}>
        <DropdownMenu.Content
          className="ck-agent-menu ck-agent-font-menu"
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          loop
          lang={locale}
        >
          {/* Radix names the menu by its trigger ("Fonts: Reem Kufi / …"); the radio group says what it holds. */}
          <DropdownMenu.RadioGroup
            aria-label={t(locale, 'plan.fonts.menu')}
            value={selected?.id ?? ''}
            onValueChange={(id) => {
              if (id !== selected?.id) onSelect(id);
            }}
          >
            {offered.map((pair) => (
              <DropdownMenu.RadioItem
                key={pair.id}
                value={pair.id}
                className="ck-agent-menu__item ck-agent-font-menu__item"
              >
                <span className="ck-agent-font-menu__check">
                  <DropdownMenu.ItemIndicator>
                    <AgentIcon name="check" />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="ck-agent-font-menu__names">
                  {facesOf(pair).map((face, index) => (
                    <Fragment key={face}>
                      {/* Heard between the faces ("Reem Kufi IBM Plex…"); a grid drops it. */}
                      {index === 0 ? null : ' '}
                      <bdi
                        className="ck-agent-font-menu__name"
                        data-face={index === 0 ? 'heading' : 'body'}
                      >
                        {face}
                      </bdi>
                    </Fragment>
                  ))}
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
