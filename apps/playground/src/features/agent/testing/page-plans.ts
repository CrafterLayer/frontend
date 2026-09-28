import { validatePagePlan, type PagePlan, type PagePlanCandidate } from '@craftkit/builder';

/**
 * Page plans for stories and tests (SPEC §4.11, §7.6 E6): candidates written the way the
 * planner writes them, and the validated `PagePlan` the engine's own `validatePagePlan`
 * makes of each. Nothing here constructs a `PagePlan` by hand: a fixture the real validator
 * would refuse would test a plan no build can ever receive.
 *
 * Colours are measured, not hoped: on #fbfbfd and #ffffff the ink #0e1116 reads 18.6:1 and
 * more, the muted #475569 7.2:1 and more, and white on the teal #0f766e 5.47:1 (WCAG AA is
 * 4.5:1), so the accent also reads as text and the engine derives `accentInk` from it.
 */

/** An Arabic dental-clinic page: header, hero, two bands, a booking CTA and a footer. */
export function clinicPlanCandidate(): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang: 'ar' },
    title: 'عيادة الابتسامة',
    description: 'عيادة أسنان في عمّان، والحجز عبر واتساب.',
    tokens: {
      bg: '#fbfbfd',
      surface: '#ffffff',
      ink: '#0e1116',
      muted: '#475569',
      accent: '#0f766e',
      onAccent: '#ffffff',
      border: '#e2e8f0',
      fontDisplay: { family: 'Reem Kufi', weights: [500, 700] },
      fontBody: { family: 'IBM Plex Sans Arabic', weights: [400, 600] },
      radius: 'xl',
      signature: 'رقم الهاتف كبيرًا فوق زر الحجز',
    },
    primaryCta: { label: 'احجز موعدًا', href: '#booking' },
    nav: [
      { label: 'الخدمات', anchorId: 'services' },
      { label: 'الأطباء', anchorId: 'doctors' },
      { label: 'الحجز', anchorId: 'booking' },
    ],
    sections: [
      {
        key: 'header',
        role: 'header',
        title: 'الترويسة',
        anchorId: 'top',
        purpose: 'اسم العيادة وروابط الأقسام.',
      },
      {
        key: 'hero',
        role: 'hero',
        title: 'ابتسامة تثق بها',
        anchorId: 'hero',
        purpose: 'ما تقدمه العيادة، ودعوة إلى أول حجز.',
        mustSay: ['في عمّان'],
      },
      {
        key: 'services',
        role: 'band',
        title: 'الخدمات',
        anchorId: 'services',
        purpose: 'خدمات العيادة الست بسطر لكل خدمة.',
      },
      {
        key: 'doctors',
        role: 'band',
        title: 'الأطباء',
        anchorId: 'doctors',
        purpose: 'الأطباء وتخصصاتهم.',
      },
      {
        key: 'booking',
        role: 'cta',
        title: 'الحجز',
        anchorId: 'booking',
        purpose: 'الحجز عبر واتساب برقم واضح.',
      },
      {
        key: 'footer',
        role: 'footer',
        title: 'التذييل',
        anchorId: 'contact',
        purpose: 'العنوان والدوام.',
      },
    ],
    facts: [
      { key: 'phone', sample: '+962 79 000 0000', section: 'booking' },
      { key: 'hours', sample: 'السبت إلى الخميس، 9 إلى 5', section: 'footer' },
    ],
  };
}

/** A candidate through the real validator; a fixture it refuses fails loudly, here. */
export function validatedPlan(candidate: PagePlanCandidate): PagePlan {
  const result = validatePagePlan(candidate);
  if (!result.ok) {
    throw new Error(
      `fixture plan refused: ${result.issues.map((issue) => `${issue.path}: ${issue.message}`).join(' | ')}`,
    );
  }
  return result.plan;
}

/** The clinic plan as the engine hands it to Plan mode: validated and frozen. */
export function clinicPlan(): PagePlan {
  return validatedPlan(clinicPlanCandidate());
}
