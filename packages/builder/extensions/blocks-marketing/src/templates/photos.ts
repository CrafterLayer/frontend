import type { BilingualText } from './types';

/*
  The template photo list (agent-script DESIGN §B.2, package templates-core).

  Every URL below answered a real GET with 200 and an image/* content type on
  2026-10-08 (durable/agent-script/photo-verify.mjs; curl is blocked here, so
  the check uses node's fetch), and every photo was looked at on a contact
  sheet before its alt text was written: the alt says what is IN the picture,
  in both languages. Unbranded subjects only — no visible product logos.

  Sources: Unsplash (Unsplash License) and, where the shared photo catalog
  already has the topic, its Pexels entries copied verbatim
  (packages/builder/ai/src/context/providers/photo-catalog.data.ts, Pexels
  License). Both licences allow free commercial use without attribution.

  Templates reach a photo only through `photo(topic, index, lang)` in
  build.ts, which throws on an unknown topic or index, so a typo fails a test
  instead of rendering a broken image. Indexes are positional: append, never
  reorder.
*/

export interface TemplatePhoto {
  /** The exact verified address (w=1600). Thumbnails swap in w=640. */
  readonly src: string;
  readonly alt: BilingualText;
  /** When `src` last answered 200 image/*. */
  readonly verifiedAt: string;
}

export const TEMPLATE_PHOTOS_VERIFIED_AT = '2026-10-08';

const at = TEMPLATE_PHOTOS_VERIFIED_AT;

export const TEMPLATE_PHOTOS: Readonly<Record<string, readonly TemplatePhoto[]>> = {
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
  /*
    Professional portraits for team members, doctors, agents and speakers.
    Varied on purpose; each alt describes the photo, never an invented name,
    because the name beside it is template copy the owner will replace.
  */
  people: [
    {
      src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling woman in a grey blazer by an office window',
        ar: 'امرأة مبتسمة بسترة رمادية قرب نافذة مكتب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Man in glasses and a dark suit', ar: 'رجل بنظارة وبدلة داكنة' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling woman with curly hair in a striped cardigan',
        ar: 'امرأة مبتسمة بشعر مجعّد وسترة مقلّمة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man in a dark suit and tie with folded arms',
        ar: 'رجل ببدلة داكنة وربطة عنق عاقد ذراعيه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling woman with dark hair on a light background',
        ar: 'امرأة مبتسمة بشعر داكن على خلفية فاتحة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Smiling man in a white T-shirt', ar: 'رجل مبتسم بقميص أبيض' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Woman with dark hair in a checked shirt', ar: 'امرأة بشعر داكن وقميص مربّعات' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1629425733761-caae3b5f2e50?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bearded man in a navy sweater with folded arms',
        ar: 'رجل ملتحٍ بكنزة كحلية عاقد ذراعيه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Smiling woman with long dark hair', ar: 'امرأة مبتسمة بشعر طويل داكن' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling man with glasses and a grey beard',
        ar: 'رجل مبتسم بنظارة ولحية رمادية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Smiling woman in a red sweater', ar: 'امرأة مبتسمة بكنزة حمراء' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man with short dark hair and a light smile',
        ar: 'رجل بشعر داكن قصير وابتسامة خفيفة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Woman with a short red bob outdoors',
        ar: 'امرأة بشعر أحمر قصير في الهواء الطلق',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Older man with glasses in an olive shirt',
        ar: 'رجل كبير السن بنظارة وقميص زيتي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Woman with long brown hair in a striped top',
        ar: 'امرأة بشعر بني طويل وبلوزة مقلّمة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man with glasses and a beard resting his chin on his hand',
        ar: 'رجل بنظارة ولحية يسند ذقنه بيده',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man in glasses and a grey T-shirt with folded arms',
        ar: 'رجل بنظارة وقميص رمادي عاقد ذراعيه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Doctor in a white coat smiling outdoors',
        ar: 'طبيبة بمعطف أبيض تبتسم في الهواء الطلق',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Doctor with a stethoscope and glasses, arms folded',
        ar: 'طبيب بسماعة طبية ونظارة عاقد ذراعيه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=1600&q=80',
      alt: { en: 'Smiling clinician in teal scrubs', ar: 'أخصائية مبتسمة بزي طبي فيروزي' },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `business`).
    {
      src: 'https://images.pexels.com/photos/10347162/pexels-photo-10347162.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Portrait of a professional woman in hijab', ar: 'صورة لموظفة محترفة بالحجاب' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Woman with short natural hair against a red wall',
        ar: 'امرأة بشعر طبيعي قصير أمام جدار أحمر',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man with stubble in a grey knit sweater',
        ar: 'رجل بلحية خفيفة وكنزة صوفية رمادية',
      },
      verifiedAt: at,
    },
  ],
  // templates-verticals additions
  /*
    The five vertical templates (DESIGN §B.3). Every URL answered GET 200
    image/* on 2026-10-08 (durable/agent-script/photo-verify.mjs) and was
    looked at on a contact sheet before its alt text was written. Pexels
    entries are copied verbatim from the shared photo catalog
    (photo-catalog.data.ts topics restaurant, sweets); the rest are Unsplash.
    No alcohol, no visible brand logos.
  */
  restaurant: [
    // Mirrored from the shared photo catalog (topic `restaurant`). The hero.
    {
      src: 'https://images.pexels.com/photos/15029824/pexels-photo-15029824.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Table spread of rice, salads and grilled dishes', ar: 'مائدة أرز وسلطات ومشاوي' },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `restaurant`).
    {
      src: 'https://images.pexels.com/photos/27556261/pexels-photo-27556261.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Hummus drizzled with olive oil and mezze', ar: 'حمّص بزيت الزيتون مع مقبلات' },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `restaurant`).
    {
      src: 'https://images.pexels.com/photos/21856018/pexels-photo-21856018.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Hand holding falafel over a mezze platter', ar: 'يد تحمل فلافل فوق طبق مقبلات' },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Golden fried pastries with green chilli on a wooden board',
        ar: 'معجنات مقلية ذهبية مع فلفل أخضر على لوح خشبي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Leafy salad with strawberries and crumbled white cheese',
        ar: 'سلطة أوراق خضراء بالفراولة والجبنة البيضاء المفتتة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Grilled chicken, kebab skewers and roasted vegetables on a tray',
        ar: 'دجاج مشوي وأسياخ كباب وخضار مشوية على صينية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1530469912745-a215c6b256ea?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Chicken shawarma roasting on a vertical spit',
        ar: 'شاورما دجاج تُشوى على السيخ العمودي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Grilled salmon fillet with greens on a dark plate',
        ar: 'فيليه سلمون مشوي مع خضار ورقية في صحن داكن',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Sliced grilled beef with fresh herbs and chilli',
        ar: 'شرائح لحم بقري مشوي مع أعشاب طازجة وفلفل حار',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Spiced rice with vegetables on a white plate',
        ar: 'أرز متبّل بالخضار في صحن أبيض',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Milk puddings topped with fresh strawberries',
        ar: 'مهلبية مغطاة بالفراولة الطازجة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Chocolate layer cake with piped frosting',
        ar: 'كعكة شوكولاتة بطبقات وكريمة مزيّنة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1599021456807-25db0f974333?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Lemon and mint drink over crushed ice',
        ar: 'مشروب الليمون والنعناع مع ثلج مجروش',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Dining room with dark wood, pendant lights and set tables',
        ar: 'صالة طعام بخشب داكن وإضاءة معلّقة وطاولات مُعدّة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Airy restaurant hall with wooden tables and plants',
        ar: 'صالة مطعم واسعة بطاولات خشبية ونباتات',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Chef finishing a dish under copper lamps',
        ar: 'طاهٍ يضع اللمسة الأخيرة على طبق تحت مصابيح نحاسية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Chef cooking over an open flame in a busy kitchen',
        ar: 'طاهٍ يطهو على لهب مكشوف في مطبخ نشط',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Dining room with white tablecloths and wide windows',
        ar: 'صالة طعام بمفارش بيضاء ونوافذ واسعة',
      },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `sweets`).
    {
      src: 'https://images.pexels.com/photos/8289911/pexels-photo-8289911.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: {
        en: 'Shredded kataifi dough ready for kunafa',
        ar: 'عجينة الكنافة المبشورة جاهزة للخَبز',
      },
      verifiedAt: at,
    },
    // Mirrored from the shared photo catalog (topic `sweets`).
    {
      src: 'https://images.pexels.com/photos/8290047/pexels-photo-8290047.jpeg?auto=compress&cs=tinysrgb&w=1600',
      alt: { en: 'Hands layering pastry dough for baklava', ar: 'أيدٍ تفرد عجينة البقلاوة' },
      verifiedAt: at,
    },
  ],
  clinic: [
    {
      src: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bright dental treatment room with a patient chair',
        ar: 'غرفة علاج أسنان مضيئة مع كرسي المريض',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1612531386530-97286d97c2d2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bearded doctor with glasses and a stethoscope, arms folded',
        ar: 'طبيب ملتحٍ بنظارة وسماعة طبية يعقد ذراعيه',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling clinician in blue scrubs with a stethoscope',
        ar: 'أخصائي مبتسم بزي طبي أزرق وسماعة طبية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling doctor in a white suit with a stethoscope',
        ar: 'طبيبة مبتسمة ببدلة بيضاء وسماعة طبية',
      },
      verifiedAt: at,
    },
  ],
  portfolio: [
    {
      src: 'https://images.unsplash.com/photo-1545235617-9465d2a55698?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Phone showing a mobile app in front of a laptop',
        ar: 'هاتف يعرض تطبيقاً أمام حاسوب محمول',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Desktop monitor showing mobile app screen designs',
        ar: 'شاشة حاسوب تعرض تصاميم شاشات تطبيق جوال',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Hand holding a phone with a finance dashboard app',
        ar: 'يد تحمل هاتفاً عليه تطبيق لوحة مالية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Tablet with a hand-drawn letter beside a red notebook',
        ar: 'جهاز لوحي عليه حرف مرسوم يدوياً بجانب دفتر أحمر',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Colour swatches and printed design samples on a desk',
        ar: 'عينات ألوان ونماذج تصميم مطبوعة على مكتب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Laptop on a sofa showing a data dashboard',
        ar: 'حاسوب محمول على أريكة يعرض لوحة بيانات',
      },
      verifiedAt: at,
    },
  ],
  realestate: [
    {
      src: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Dubai skyline at sunset with Burj Khalifa above the highways',
        ar: 'أفق دبي عند الغروب وبرج خليفة فوق الطرق السريعة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Modern villa with a long pool and a timber ceiling',
        ar: 'فيلا حديثة بمسبح طويل وسقف خشبي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Open-plan living room with a white sofa and a timber wall',
        ar: 'صالة معيشة مفتوحة بأريكة بيضاء وجدار خشبي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Two-storey modern townhouse with timber cladding',
        ar: 'منزل حديث من طابقين بواجهة خشبية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Glass-walled living space with stairs and a pool view',
        ar: 'مساحة معيشة بجدران زجاجية ودرج وإطلالة على المسبح',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'White family villa with palm trees and a pool',
        ar: 'فيلا عائلية بيضاء مع نخيل ومسبح',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Modern apartment building against a blue sky',
        ar: 'مبنى شقق حديث تحت سماء زرقاء',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Bright living room with tall windows',
        ar: 'صالة معيشة مضيئة بنوافذ طويلة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'White kitchen with an island and pendant lights',
        ar: 'مطبخ أبيض بجزيرة وإضاءة معلّقة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Calm bedroom with glass doors to the garden',
        ar: 'غرفة نوم هادئة بأبواب زجاجية على الحديقة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Grey bathroom with a freestanding tub',
        ar: 'حمّام رمادي بحوض استحمام مستقل',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Dining table in a bright bay window',
        ar: 'طاولة طعام في نافذة بارزة مضيئة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Living room with a long sofa and leather ottomans',
        ar: 'صالة معيشة بأريكة طويلة ومقاعد جلدية صغيرة',
      },
      verifiedAt: at,
    },
  ],
  events: [
    {
      src: 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Audience facing a lit stage in a large hall',
        ar: 'جمهور أمام منصة مضاءة في قاعة كبيرة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Presentation on a big screen in a dark auditorium',
        ar: 'عرض تقديمي على شاشة كبيرة في قاعة مظلمة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1559223607-a43c990c692c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Attendees listening from rows of seats',
        ar: 'حضور يستمعون من صفوف المقاعد',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1561489396-888724a1543d?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Panel discussion on a round stage',
        ar: 'جلسة حوارية على منصة دائرية',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Workshop group at a wall of sticky notes',
        ar: 'مجموعة في ورشة عمل أمام جدار من الملاحظات اللاصقة',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Speaker talking to a seated group in a brick hall',
        ar: 'متحدث أمام مجموعة جالسة في قاعة بجدران من الطوب',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Team sketching ideas on a whiteboard',
        ar: 'فريق يرسم أفكاره على لوح أبيض',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Conference hall set with round tables and screens',
        ar: 'قاعة مؤتمرات مجهّزة بطاولات دائرية وشاشات',
      },
      verifiedAt: at,
    },
  ],
  /** Extra portraits for agents and speakers (the `people` list stays templates-core's). */
  portraits: [
    {
      src: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling man in a dark jacket and scarf',
        ar: 'رجل مبتسم بسترة داكنة ووشاح',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1546961329-78bef0414d7c?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling woman with wavy hair in a denim jacket',
        ar: 'امرأة مبتسمة بشعر مموّج وسترة جينز',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1573497019236-17f8177b81e8?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Woman in a cream cardigan seated in a glass office',
        ar: 'امرأة بسترة كريمية تجلس في مكتب زجاجي',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling man in a light blue shirt',
        ar: 'رجل مبتسم بقميص أزرق فاتح',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Smiling woman with glasses in a plaid shirt',
        ar: 'امرأة مبتسمة بنظارة وقميص مربّعات',
      },
      verifiedAt: at,
    },
    {
      src: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=1600&q=80',
      alt: {
        en: 'Man in a black turtleneck and an orange beanie',
        ar: 'رجل بكنزة سوداء عالية الياقة وقبعة برتقالية',
      },
      verifiedAt: at,
    },
  ],
  // end templates-verticals additions
};
