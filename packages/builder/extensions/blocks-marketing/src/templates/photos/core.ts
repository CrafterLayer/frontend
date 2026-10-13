import { TEMPLATE_PHOTOS_VERIFIED_AT, type TemplatePhoto } from './verified';

/* The four core templates' photos (templates-core): saas, agency, store, services. */

const at = TEMPLATE_PHOTOS_VERIFIED_AT;

export const CORE_PHOTOS: Readonly<Record<string, readonly TemplatePhoto[]>> = {
  saas: [
    {
      src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Analytics dashboard with bar and line charts on a dark screen',
        ar: 'لوحة تحليلات بمخططات أعمدة وخطوط على شاشة داكنة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Laptop showing a sales analytics dashboard',
        ar: 'حاسوب محمول يعرض لوحة تحليلات المبيعات',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Hand placing sticky notes on a product planning board',
        ar: 'يد تثبّت ملاحظات لاصقة على لوحة تخطيط المنتج',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Laptops and notebooks seen from above during a team work session',
        ar: 'حواسيب ودفاتر من الأعلى أثناء جلسة عمل للفريق',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Product team talking through work at their desks',
        ar: 'فريق منتج يناقش العمل على مكاتبه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Two colleagues celebrating a milestone with a high five',
        ar: 'زميلان يحتفلان بإنجاز بتصفيقة كفّين',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Checking a mobile app beside an open laptop',
        ar: 'متابعة تطبيق على الهاتف بجانب حاسوب محمول مفتوح',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bright open-plan office with people at work',
        ar: 'مكتب مفتوح مضيء وفريق منهمك في العمل',
      },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `tech`).
    {
      src: 'https://images.pexels.com/photos/34804003/pexels-photo-34804003.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Laptop showing code on a wooden desk',
        ar: 'حاسوب محمول يعرض شيفرة على مكتب خشبي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/5926382/pexels-photo-5926382.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Developer typing code on a laptop',
        ar: 'مبرمج يكتب الشيفرة على حاسوب محمول',
      },
      verifiedAt: at,
    },
  ],
  agency: [
    {
      src: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bright design studio with a reading lamp and lounge chairs',
        ar: 'استوديو تصميم مضيء بمصباح قراءة ومقاعد مريحة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Abstract fluid artwork in gold, black and blue',
        ar: 'عمل فني تجريدي سائل بالذهبي والأسود والأزرق',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Angular white building facade against a pale sky',
        ar: 'واجهة مبنى أبيض بزوايا حادة أمام سماء صافية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Desktop screen showing a colour palette and an interface design',
        ar: 'شاشة مكتبية تعرض لوحة ألوان وتصميم واجهة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Hand-drawn app screen sketches coloured with watercolour',
        ar: 'رسومات يدوية لشاشات تطبيق ملوّنة بالألوان المائية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Website design open across two monitors',
        ar: 'تصميم موقع مفتوح على شاشتين',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Soft abstract gradient in blue, pink and violet',
        ar: 'تدرّج لوني تجريدي ناعم بالأزرق والوردي والبنفسجي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Designer sketching wireframes on a tablet',
        ar: 'مصمم يرسم مخططات واجهة على جهاز لوحي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Hand drawing interface wireframes on paper',
        ar: 'يد ترسم مخططات واجهة على الورق',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Blueprint-style wireframes on a dark background',
        ar: 'مخططات واجهة بأسلوب المخطط الأزرق على خلفية داكنة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Team meeting around a long table with laptops',
        ar: 'اجتماع فريق حول طاولة طويلة عليها حواسيب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Laptop and drawing tablet beside colour swatches',
        ar: 'حاسوب محمول ولوح رسم بجانب عيّنات ألوان',
      },
      verifiedAt: at,
    },
  ],
  store: [
    // Mirrored from the shared photo catalog (topic `perfume`).
    {
      src: 'https://images.pexels.com/photos/30618765/pexels-photo-30618765.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Oud perfume bottle with rose petals on a dark background',
        ar: 'زجاجة عطر عود مع بتلات ورد على خلفية داكنة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Amber perfume bottle resting on draped linen',
        ar: 'زجاجة عطر كهرماني على قماش كتّان منسدل',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1622618991746-fe6004db3a47?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Perfume bottle suspended against a warm amber backdrop',
        ar: 'زجاجة عطر معلّقة في الهواء أمام خلفية كهرمانية دافئة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Hand holding a pink glass perfume bottle',
        ar: 'يد تحمل زجاجة عطر وردية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Dropper bottle of fragrance oil on a wooden board with leaves',
        ar: 'قارورة زيت عطري بقطّارة على لوح خشبي بجانب أوراق خضراء',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Lit scented candle in a glass jar',
        ar: 'شمعة معطّرة مضاءة في وعاء زجاجي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/1961792/pexels-photo-1961792.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Perfume bottle resting on soft fabric',
        ar: 'زجاجة عطر على قماش ناعم',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Pink gift box tied with a gold ribbon',
        ar: 'علبة هدية وردية مربوطة بشريط ذهبي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Fragrance oil bottle among smooth stones and dried botanicals',
        ar: 'قارورة زيت عطري بين أحجار ملساء ونباتات مجففة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1605651202774-7d573fd3f12d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Candle glowing on a wooden table',
        ar: 'شمعة متوهجة على طاولة خشبية',
      },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `fashion`).
    {
      src: 'https://images.pexels.com/photos/5424922/pexels-photo-5424922.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Clothing racks inside a boutique',
        ar: 'رفوف ملابس داخل متجر أزياء',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/6593778/pexels-photo-6593778.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Two women choosing clothes from a rack',
        ar: 'امرأتان تختاران الملابس من الرف',
      },
      verifiedAt: at,
    },
  ],
  services: [
    // Mirrored from the shared photo catalog (topics `business` and `law`).
    {
      src: 'https://images.pexels.com/photos/8154928/pexels-photo-8154928.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Businesswoman in hijab leading an office meeting',
        ar: 'سيدة أعمال بالحجاب تقود اجتماعاً في المكتب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/4427422/pexels-photo-4427422.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Lawyers reviewing a document together',
        ar: 'محامون يراجعون مستنداً معاً',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/8112159/pexels-photo-8112159.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Lawyer shaking hands with a client in an office',
        ar: 'محامٍ يصافح موكلاً في مكتبه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.pexels.com/photos/10347160/pexels-photo-10347160.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Women in hijab reviewing documents in a meeting',
        ar: 'نساء بالحجاب يراجعن أوراقاً في اجتماع عمل',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bronze statue of Lady Justice holding scales',
        ar: 'تمثال برونزي لسيدة العدالة تحمل الميزان',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Library of bound law books beside a classical bust',
        ar: 'مكتبة كتب قانونية مجلّدة بجانب تمثال نصفي كلاسيكي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Signing a document with a fountain pen',
        ar: 'توقيع مستند بقلم حبر',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Glass office towers seen from street level',
        ar: 'أبراج مكاتب زجاجية من مستوى الشارع',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Financial reports, a calculator and a pen on a desk',
        ar: 'تقارير مالية وآلة حاسبة وقلم على مكتب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Consultant meeting a client across a desk',
        ar: 'مستشارة تلتقي عميلة على مكتبها',
      },
      verifiedAt: at,
    },
  ],
};
