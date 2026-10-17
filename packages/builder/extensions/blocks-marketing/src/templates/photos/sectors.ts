import type { TemplatePhoto } from './verified';

/*
  Photos for the six sector templates (education, fitness, law firm,
  nonprofit, hotel and travel, personal brand).

  Nothing here is new to the project: every entry is copied verbatim — address
  and both alt texts — from the shared photo catalog
  (packages/builder/ai/src/context/providers/photo-catalog.data.ts, Pexels
  License), whose entries were each fetched (200, image/jpeg) and looked at on a
  contact sheet before their alt text was written. The comment above each entry
  names its catalog id and topic so the two lists can be compared line by line.

  `verifiedAt` is the catalog's own date (PHOTO_CATALOG_VERIFIED_AT), the last
  time these exact addresses answered 200: they were not re-fetched for this
  list, because the photo CDNs are not reachable from the authoring sandbox.
  The sector templates' other pictures (people, interiors, offices, workshops)
  reuse photos already on this list under their own topics.
*/

const CATALOG_VERIFIED_AT = '2026-09-28';

export const SECTOR_PHOTOS: Readonly<Record<string, readonly TemplatePhoto[]>> = {
  fitness: [
    // pexels-3757943, catalog topic `gym` (portrait, people: faces).
    {
      src: 'https://images.pexels.com/photos/3757943/pexels-photo-3757943.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Woman training with dumbbells in a gym', ar: 'امرأة تتمرن بالدمبل في النادي' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-6455963, catalog topic `gym` (portrait, people: faces).
    {
      src: 'https://images.pexels.com/photos/6455963/pexels-photo-6455963.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Man lifting a dumbbell in the gym', ar: 'رجل يرفع الدمبل في النادي الرياضي' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-17092539, catalog topic `gym` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/17092539/pexels-photo-17092539.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Dumbbell on a clean grey background', ar: 'دمبل على خلفية رمادية نظيفة' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
  ],
  nonprofit: [
    // pexels-6995212, catalog topic `charity` (landscape, people: faces).
    {
      src: 'https://images.pexels.com/photos/6995212/pexels-photo-6995212.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Volunteers packing food donations', ar: 'متطوعون يجهزون سلال التبرعات الغذائية' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-6646923, catalog topic `charity` (landscape, people: faces).
    {
      src: 'https://images.pexels.com/photos/6646923/pexels-photo-6646923.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Volunteers handing out food at a charity table',
        ar: 'متطوعون يوزعون الطعام على طاولة خيرية',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-33168420, catalog topic `farm` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/33168420/pexels-photo-33168420.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Sunlit path through an olive grove', ar: 'ممر مشمس بين أشجار الزيتون' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-7427851, catalog topic `ramadan` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/7427851/pexels-photo-7427851.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Bowl of dates beside an open Quran', ar: 'وعاء تمر بجانب مصحف مفتوح' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-7579831, catalog topic `medical` (landscape, people: faces).
    {
      src: 'https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Doctor talking with a patient in a bright clinic',
        ar: 'طبيبة تتحدث مع مريض في عيادة مضيئة',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-34803738, catalog topic `farm` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/34803738/pexels-photo-34803738.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Olive grove with spring flowers under blue sky',
        ar: 'بستان زيتون بأزهار الربيع تحت سماء زرقاء',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-7088834, catalog topic `medical` (landscape, people: hands).
    {
      src: 'https://images.pexels.com/photos/7088834/pexels-photo-7088834.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Doctor filling a medical form for a patient',
        ar: 'طبيب يعبئ نموذجاً طبياً لمريض',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-5283373, catalog topic `farm` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/5283373/pexels-photo-5283373.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Young plantation rows under a mountain sky',
        ar: 'صفوف مزرعة فتية تحت سماء جبلية',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
  ],
  hotel: [
    // pexels-261327, catalog topic `hotel` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/261327/pexels-photo-261327.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Hotel pool overlooking the sea at sunset', ar: 'مسبح فندق يطل على البحر' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-189296, catalog topic `hotel` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Resort pool with white umbrellas under blue sky',
        ar: 'مسبح منتجع بمظلات بيضاء تحت سماء زرقاء',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-18717341, catalog topic `travel` (portrait, people: none).
    {
      src: 'https://images.pexels.com/photos/18717341/pexels-photo-18717341.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'The Treasury at Petra carved in rose sandstone',
        ar: 'الخزنة في البتراء منحوتة في الصخر الوردي',
      },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-28086996, catalog topic `travel` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/28086996/pexels-photo-28086996.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Wadi Rum desert at golden hour', ar: 'صحراء وادي رم عند الساعة الذهبية' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-23124407, catalog topic `travel` (landscape, people: none).
    {
      src: 'https://images.pexels.com/photos/23124407/pexels-photo-23124407.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Ad-Deir monastery at Petra', ar: 'الدير في البتراء' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
    // pexels-720254, catalog topic `travel` (portrait, people: none).
    {
      src: 'https://images.pexels.com/photos/720254/pexels-photo-720254.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Rock-cut tomb in Petra, Jordan', ar: 'واجهة منحوتة في الصخر في البتراء' },
      verifiedAt: CATALOG_VERIFIED_AT,
    },
  ],
};
