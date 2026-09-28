import type { AiSkillDefinitionV1 } from '../types';
import { INDUSTRY_LOCAL_ACTIONS, INDUSTRY_SHELL, PAGE_INTENTS, industryConflicts } from './shared';

/**
 * Clinics, dentists, beauty salons and barbers: appointment trades.
 *
 * What they share is the first screen's three questions — what is treated,
 * who treats it, how to book — and one honesty rule the generic composition
 * never stated: a doctor's name and licence are a person's own facts. An
 * invented one on a medical page is not a sample, it is a claim. Keywords
 * are whole words (2026-09-28), and still avoid words that name something
 * else as often: "مشغل" is also a video player, "جلدية" also leather.
 */
export const CLINIC_PAGE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.clinic-page',
  name: 'Clinic, salon and appointment page',
  description:
    'An appointment business page: what is treated, who treats it, how to book — services, practitioners, booking steps, FAQ, hours and a WhatsApp booking.',
  version: '1.0.2',
  source: 'builtin',
  trust: 'builtin',
  priority: 86,
  activation: {
    mode: 'auto',
    intents: PAGE_INTENTS,
    keywords: [
      'clinic',
      'dentist',
      'dental',
      'doctor',
      'physician',
      'medical center',
      'medical centre',
      'physiotherapy',
      'dermatology',
      'dentistry',
      'orthodont',
      'pediatric',
      'veterinary',
      'beauty salon',
      'hair salon',
      'nail salon',
      'day spa',
      // A three-letter last word takes no endings since 2026-09-28 (keyword-match.ts): plural listed.
      'day spas',
      'spa center',
      'spa centre',
      'massage',
      'barber',
      'barbershop',
      'عيادة',
      'عياده',
      'عيادات',
      'طبيب',
      'أطباء',
      'اطباء',
      'دكتور',
      'أسنان',
      'اسنان',
      'مركز طبي',
      'مستشفى',
      'مستشفي',
      'علاج طبيعي',
      /*
        Not a bare 'جلدية': it is leather as often as skin, and "متجر حقائب
        جلدية" (a leather-bags shop) loaded this page over the shop's (wave-1
        verifier, 2026-09-28). Skin care needs its medical co-term.
      */
      'أمراض جلدية',
      'امراض جلدية',
      'جلدية وتجميل',
      'عيادة جلدية',
      'طب الجلد',
      'بيطري',
      'صالون تجميل',
      'صالون نسائي',
      'مركز تجميل',
      'مشغل نسائي',
      'مساج',
      'حلاق',
      'صالون حلاقة',
    ],
  },
  tags: ['booking', 'composition', 'health', 'industry'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: industryConflicts('craftkit.clinic-page'),
  instructions: `A clinic or salon page answers three questions on the first screen: what is treated, who treats it, how to book. One region per section, in this order, skipping what the request gives no material for:
1 HERO[split]: h1 the specialty and the city, a lead p text-pretty on the first visit, «احجز موعدك» / "Book a visit" on WhatsApp and a tel: link; a photo from PHOTOS YOU MAY USE, never a stranger posed as this clinic's doctor.
2 SERVICES[list]: four to eight treatments, each dt led by one of icons stethoscope / heart-pulse / shield-check / sparkles / baby / eye size 22, its dd the duration and, where the trade shows prices, a starting price. A salon or barber writes them as the menu variant instead: name, duration, price.
3 TEAM[team]: name, specialty, years. Names, licence numbers and qualifications are a person's own facts, never invented: "[اسم الطبيب]" and "[رقم الترخيص]" stay bracketed and are listed in followUp; an initials tile unless the request gives the photo.
4 BOOKING[steps]: three steps from the first message to the visit.
5 FAQ[faq]: insurance, the first visit, cost, parking.
6 VISIT[contact]: hours, the map link, WhatsApp and tel:.
${INDUSTRY_SHELL}
${INDUSTRY_LOCAL_ACTIONS}
TONE: calm and exact; no guarantees, no before-and-after claims, no "best doctor" superlatives; the services, hours and prices are realistic samples listed in followUp.`,
  references: {
    'checks/clinic.md':
      "Specialty, practitioners and booking on the first screen; services with durations; practitioners' names and licences never invented — bracketed and listed in followUp; booking steps; WhatsApp primary, tel:, hours, maps link; no guarantees or superlatives.",
  },
};
