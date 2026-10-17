import { TEMPLATE_PHOTOS_VERIFIED_AT, type TemplatePhoto } from './verified';

/*
  The five vertical templates (DESIGN §B.3). Every URL answered GET 200
  image/* on 2026-10-08 (durable/agent-script/photo-verify.mjs) and was
  looked at on a contact sheet before its alt text was written. Pexels
  entries are copied verbatim from the shared photo catalog
  (photo-catalog.data.ts topics restaurant, sweets); the rest are Unsplash.
  No alcohol, no visible brand logos.
*/

const at = TEMPLATE_PHOTOS_VERIFIED_AT;

export const VERTICAL_PHOTOS: Readonly<Record<string, readonly TemplatePhoto[]>> = {
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
};
