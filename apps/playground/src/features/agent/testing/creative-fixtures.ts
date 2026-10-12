import { t } from '../copy';
import { creativeBriefView } from '../model/creative-brief';
import type { CreativeBriefView, Locale } from '../model/view-types';

/**
 * Creative briefs for CreativeBriefCard, BuildRecord and AgentPanel stories and tests
 * (creative agent, 2026-10-12). The planned ones come from the real planner over the empty
 * state's own starters, so a fixture can never drift from what a build would show; `cast`
 * is the bible's colours on a hand-written brief.
 */
export function plannedBrief(
  locale: Locale,
  starter: 'game' | 'story' | 'bedtime' = 'game',
): CreativeBriefView {
  return creativeBriefView(t(locale, `creative.${starter}.prompt`));
}

export const CAST_BRIEFS: Readonly<Record<Locale, CreativeBriefView>> = {
  en: {
    genre: 'visual-novel',
    libs: ['dialogue', 'anim', 'fx'],
    effects: ['sparkle', 'leaves'],
    cast: [
      { id: 'layla', name: 'Layla', role: 'hero', color: '#f59e0b' },
      { id: 'omar', name: 'Omar', role: 'friend', color: '#38bdf8' },
    ],
  },
  ar: {
    genre: 'visual-novel',
    libs: ['dialogue', 'anim', 'fx'],
    effects: ['sparkle', 'leaves'],
    cast: [
      { id: 'ليلى', name: 'ليلى', role: 'البطلة', color: '#f59e0b' },
      { id: 'عمر', name: 'عمر', role: 'الصديق', color: '#38bdf8' },
    ],
  },
};
