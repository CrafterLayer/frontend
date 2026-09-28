import { formatList, t } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type { DirectionView, Locale, SwatchRole, SwatchView } from '../../model/view-types';

import './DirectionLine.css';

/** SPEC §4.8: background, surface, text, accent, text on accent, in the reading direction. */
const ROLE_ORDER = [
  'background',
  'surface',
  'text',
  'accent',
  'onAccent',
] as const satisfies readonly SwatchRole[];

function inRoleOrder(swatches: readonly SwatchView[]): readonly SwatchView[] {
  return ROLE_ORDER.flatMap((role) => swatches.filter((swatch) => swatch.role === role));
}

/** The sentence a screen reader hears for the line (SPEC §4.8 `direction.aria`). */
function spoken(locale: Locale, direction: DirectionView, swatches: readonly SwatchView[]): string {
  const colors = formatList(
    locale,
    swatches.map((swatch) => `${t(locale, `role.${swatch.role}`)} ${swatch.hex}`),
  );
  const fonts = direction.fonts;
  const mood = direction.mood;
  if (swatches.length > 0 && fonts !== undefined) {
    return t(locale, 'direction.aria', { mood, colors, fonts });
  }
  if (swatches.length > 0) return t(locale, 'direction.aria.colors', { mood, colors });
  if (fonts !== undefined) return t(locale, 'direction.aria.fonts', { mood, fonts });
  return t(locale, 'direction.aria.mood', { mood });
}

export interface DirectionLineProps {
  readonly locale: Locale;
  readonly direction: DirectionView;
  /** Appended to `ck-agent-direction`. */
  readonly className?: string | undefined;
}

/**
 * The page's direction on one read-only line (SPEC §4.8 DirectionLine): five 12px swatches of
 * the page's own colours, the mood phrase in Graphite, and, from 400px, the font pair in Slate
 * at the inline end. Before the engine sends structured direction (SPEC §7.6 E7) it is the
 * direction prose on one line, with no swatches.
 *
 * The swatches are content, not chrome (SPEC §2.1 rule 4): each sits inside the
 * content-outline ring and tints nothing around it. Drawn for the eye and spoken for the ear
 * separately, like ChangeLines: the drawn line is `aria-hidden`, and one sentence from the
 * catalog names the mood, each colour by its role, and the fonts.
 */
export function DirectionLine({ locale, direction, className }: DirectionLineProps) {
  const swatches = inRoleOrder(direction.swatches ?? []);
  const moodLang = resolveLang(direction.mood, locale);
  return (
    <p
      className={
        className === undefined ? 'ck-agent-direction' : `ck-agent-direction ${className}`
      }
    >
      <span className="ck-agent-direction__visual" aria-hidden="true">
        {swatches.length === 0 ? null : (
          <span className="ck-agent-direction__swatches">
            {swatches.map((swatch) => (
              <span
                key={swatch.role}
                className="ck-agent-direction__swatch"
                data-role={swatch.role}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
          </span>
        )}
        <bdi
          className="ck-agent-direction__mood"
          lang={moodLang === locale ? undefined : moodLang}
        >
          {direction.mood}
        </bdi>
        {direction.fonts === undefined ? null : (
          <bdi className="ck-agent-direction__fonts" dir="ltr">
            {direction.fonts}
          </bdi>
        )}
      </span>
      <span className="bldr-visually-hidden">{spoken(locale, direction, swatches)}</span>
    </p>
  );
}
