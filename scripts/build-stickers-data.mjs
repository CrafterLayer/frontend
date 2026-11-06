#!/usr/bin/env node
/*
  Pick the kid-friendly Fluent Emoji Flat stickers `s.lib.stickers` ships (sticker art, 2026-11-05).

    node scripts/build-stickers-data.mjs

  Reads @iconify-json/fluent-emoji-flat@1.2.5 (a devDependency of @craftkit/builder-media-engines;
  the package itself never ships) as data: Microsoft's Fluent Emoji Flat (MIT, © Microsoft
  Corporation) in Iconify JSON, one SVG body per icon on a 32 × 32 grid. The curated list below
  (animals, nature, sky, food, vehicles, home, clothes, toys, school, music, sports, fantasy, faces,
  gestures, people, the Arab and Muslim everyday set, and numbers and shapes) is copied unmodified
  into a generated module with each sticker's group and its words: our own English and Arabic
  aliases (Levantine and MSA) first, then the Arabic words the AI package's art catalog already
  gives the same Fluent name (packages/builder/ai/src/art-catalog/art-words.ts, read here as text,
  so the library never imports the AI package). A word two stickers claim stays with the first.

  Left out on purpose: flags, skin-tone variants (only the default tone of a person is kept),
  alcohol, tobacco, weapons, gambling, medical and injury imagery, pork, religious symbols beyond
  the mosque, the Kaaba and the crescent, and anything adult. The output is deterministic: the same
  tarball and list always write the same bytes; `scripts/build-studio-engines.mjs stickers` then
  bundles it into ck-lib-stickers.js.
*/

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages/builder/extensions/media-engines');
const outFile = join(packageDir, 'src/studio/libs/stickers/stickers.generated.ts');
const pack = join(packageDir, 'node_modules/@iconify-json/fluent-emoji-flat');
const artCatalog = join(repoRoot, 'packages/builder/ai/src/art-catalog');
const prettier = createRequire(join(repoRoot, 'package.json'))('prettier');

const PACKAGE = '@iconify-json/fluent-emoji-flat';
const VERSION = '1.2.5';

/*
  The stickers, by group, in the order `names` lists them. Each line reads `name: word|word`: the
  Fluent name, then the words a child or a script may use for it (Arabic first, a few English
  synonyms after). The group order is the claim order when two stickers want the same word.
*/
const STICKER_GROUPS = {
  animals: [
    'cat: قطة|بسة|بس|هرة|قط|بسينة|kitty',
    'dog: كلب|كلبة|جرو|puppy|doggy',
    'mouse: فأر|فار|فارة|جرذ صغير',
    'hamster: هامستر|همستر',
    'rabbit: أرنب|ارنوب|أرانب|bunny',
    'fox: ثعلب|ثعالب',
    'bear: دب|دببة',
    'polar-bear: دب قطبي|دب أبيض',
    'panda: باندا|دب الباندا',
    'koala: كوالا',
    'tiger: نمر|نمور',
    'lion: أسد|سبع|أسود|ملك الغابة',
    'leopard: فهد|نمر مرقط',
    'horse: حصان|خيل|فرس|أحصنة',
    'zebra: حمار وحشي|زيبرا',
    'donkey: حمار|حمير|جحش',
    'deer: غزال|غزالة|أيل',
    'cow: بقرة|بقر|عجل',
    'ram: كبش|خروف العيد',
    'ewe: خروف|خاروف|نعجة|غنم|غنمة|sheep|lamb',
    'goat: ماعز|عنزة|معزة|عنز|سخل',
    'giraffe: زرافة',
    'elephant: فيل|فيلة|أفيال',
    'rhinoceros: وحيد القرن|كركدن',
    'hippopotamus: فرس النهر|هيبو|hippo',
    'monkey: قرد|سعدان|قرود',
    'chipmunk: سنجاب|squirrel',
    'hedgehog: قنفذ|قنفد',
    'bat: خفاش|وطواط',
    'sloth: كسلان|حيوان الكسلان',
    'kangaroo: كنغر|كنغارو',
    'wolf: ذئب|ديب',
    'chicken: دجاجة|دجاج|جاجة|جاج|hen',
    'rooster: ديك|ديوك',
    'baby-chick: صوص|كتكوت|صيصان|chick',
    'hatching-chick: كتكوت يفقس|بيضة تفقس',
    'duck: بطة|بط',
    'swan: بجعة|بجع',
    'bird: عصفور|عصفورة|طير|طائر|عصافير',
    'dove: حمامة|حمام|يمامة|pigeon',
    'eagle: نسر|عقاب|صقر',
    'owl: بومة|بوم',
    'parrot: ببغاء|ببغا|درة',
    'peacock: طاووس',
    'flamingo: فلامنغو|نحام',
    'penguin: بطريق|بطاريق',
    'feather: ريشة|ريش',
    'nest-with-eggs: عش|عش طيور|عش بيض',
    'frog: ضفدع|ضفدعة|علجوم|ضفادع',
    'crocodile: تمساح|تماسيح',
    'turtle: سلحفاة|سلحفة|زلحفة|tortoise',
    'lizard: سحلية|حرذون',
    'snake: أفعى|حية|ثعبان',
    'sauropod: ديناصور|ديناصور طويل الرقبة|dinosaur',
    't-rex: تي ركس|ديناصور مفترس|تيرانوصور',
    'whale: حوت|حيتان',
    'dolphin: دلفين|دولفين',
    'seal: فقمة|عجل البحر',
    'fish: سمكة|سمك|سمكه|أسماك',
    'tropical-fish: سمكة ملونة|سمكة استوائية',
    'shark: قرش|سمك القرش|سمكة قرش',
    'octopus: أخطبوط',
    'crab: سلطعون|سرطان البحر|كابوريا',
    'spiral-shell: صدفة|محارة|صدف',
    'jellyfish: قنديل البحر|قنديل',
    'snail: حلزون|حلزونة|بزاقة',
    'butterfly: فراشة|فراش',
    'bug: يرقة|دودة القز|caterpillar',
    'ant: نملة|نمل',
    'honeybee: نحلة|نحل|bee',
    'lady-beetle: دعسوقة|ladybug|ladybird',
    'spider: عنكبوت|عنكبوتة',
    'scorpion: عقرب',
    'paw-prints: آثار حيوان|بصمة قطة|أثر مخلب|paws',
  ],
  nature: [
    'deciduous-tree: شجرة|شجر|أشجار|tree',
    'evergreen-tree: شجرة صنوبر|صنوبر|سرو|pine',
    'cactus: صبار|صبارة|صبير',
    'potted-plant: نبتة|أصيص|زرعة|نبتة بأصيص|plant',
    'seedling: شتلة|برعم|نبتة صغيرة|sprout',
    'herb: عشب|أعشاب|نعناع',
    'four-leaf-clover: برسيم رباعي|ورقة الحظ',
    'leaf-fluttering-in-wind: ورقة شجر|أوراق الشجر|leaf',
    'fallen-leaf: ورقة خريف|خريف|أوراق الخريف|autumn',
    'sheaf-of-rice: سنابل|سنبلة|قمح|حصاد|wheat',
    'rose: وردة|ورد|جوري|ورد جوري',
    'tulip: توليب|زهرة التوليب',
    'sunflower: دوار الشمس|عباد الشمس|عباد شمس',
    'blossom: زهرة|زهور|زهر|flower',
    'cherry-blossom: زهر الكرز|زهر الربيع|ربيع|spring',
    'white-flower: زهرة بيضاء|فل|ياسمين|jasmine',
    'hyacinth: خزامى|لافندر|ياقوتية|lavender',
    'bouquet: باقة ورد|باقة|بوكيه',
    'mushroom: فطر|فطر أحمر|عيش الغراب',
    'rock: صخرة|حجر|صخور|stone',
    'mountain: جبل|جبال',
    'volcano: بركان|براكين',
    'desert-island: جزيرة|جزيرة نائية|island',
    'national-park: حديقة وطنية|غابة|طبيعة|park',
    'camping: تخييم|مخيم|رحلة|camp',
    'tent: خيمة|خيم',
    'beach-with-umbrella: شاطئ|شط|بلاج|مصيف|beach',
    'water-wave: موج|موجة|بحر|أمواج|sea|ocean',
    'sunrise-over-mountains: شروق الشمس|شروق|صباح|morning',
    'sunset: غروب|غروب الشمس|مغرب',
    'fire: نار|نيران|حريق|شعلة|flame',
    'droplet: قطرة|قطرة ماء|ماء|مي|مية|water',
  ],
  sky: [
    'sun: شمس|الشمس',
    'sun-with-face: شمس مبتسمة|شمس بوجه',
    'sun-behind-cloud: غائم جزئيا|شمس وغيمة',
    'cloud: غيمة|سحابة|غيم|سحاب|غيوم|غيمه',
    'cloud-with-rain: مطر|شتي|أمطار|rain',
    'cloud-with-lightning-and-rain: عاصفة|عاصفة رعدية|storm',
    'cloud-with-lightning: رعد|غيمة برق|thunder',
    'cloud-with-snow: غيمة ثلج|تساقط الثلج',
    'snowflake: ثلج|تلج|ندفة ثلج|ثلوج|snow',
    'snowman: رجل الثلج|رجل ثلج|بابا ثلج',
    'tornado: إعصار|زوبعة',
    'wind-face: ريح|رياح|هواء|نسمة|wind',
    'rainbow: قوس قزح|قوس المطر|قوس الله',
    'umbrella-with-rain-drops: مظلة|شمسية|مظلة مطر|umbrella',
    'high-voltage: برق|صاعقة|كهرباء|lightning',
    'thermometer: ميزان حرارة|حرارة|ترمومتر',
    'crescent-moon: هلال|قمر|moon',
    'full-moon-face: قمر بوجه|بدر مبتسم',
    'star: نجمة|نجم|نجوم|نجمه',
    'glowing-star: نجمة لامعة|نجمة مضيئة',
    'shooting-star: شهاب|نجمة ساقطة|نيزك',
    'sparkles: لمعان|بريق|سحر|sparkle',
    'milky-way: درب التبانة|مجرة|galaxy',
    'night-with-stars: ليل|ليلة|سماء ليلية|night',
    'ringed-planet: كوكب|زحل|planet',
    'globe-showing-europe-africa: الأرض|كرة أرضية|العالم|كوكب الأرض|earth|world',
    'rocket: صاروخ|صاروخ فضاء',
    'flying-saucer: صحن طائر|مركبة فضائية|ufo',
  ],
  food: [
    'red-apple: تفاحة|تفاح|apple',
    'pear: إجاص|انجاص|كمثرى',
    'tangerine: برتقالة|برتقال|يوسفي|مندلينا|orange',
    'lemon: ليمون|ليمونة|حامض',
    'banana: موز|موزة',
    'watermelon: بطيخ|بطيخة|جبس|رقي',
    'grapes: عنب|عنقود عنب',
    'strawberry: فراولة|فريز',
    'blueberries: توت|توت أزرق|بلوبيري',
    'cherries: كرز',
    'peach: دراق|خوخ|دراقن|خوخة',
    'mango: مانجو|منجا|منقا',
    'pineapple: أناناس',
    'coconut: جوز الهند|جوز هند',
    'kiwi-fruit: كيوي|kiwi',
    'tomato: بندورة|طماطم|بندوره|طماطة',
    'eggplant: باذنجان|بتنجان',
    'avocado: أفوكادو',
    'carrot: جزر|جزرة',
    'ear-of-corn: ذرة|عرنوس ذرة|كوز ذرة|corn',
    'hot-pepper: فلفل حار|شطة|فليفلة حارة',
    'bell-pepper: فلفل|فليفلة|فلفل رومي|فلفل حلو',
    'cucumber: خيار|خيارة',
    'leafy-green: خس|سبانخ|ملفوف|lettuce',
    'broccoli: بروكلي|قرنبيط أخضر',
    'garlic: ثوم|توم',
    'onion: بصل|بصلة',
    'potato: بطاطا|بطاطس|بطاطاية',
    'bread: خبز|خبزة|توست|عيش',
    'croissant: كرواسان|كرواسون',
    'bagel: كعك|سميط|كعكة بسمسم',
    'pancakes: بان كيك|بانكيك|فطائر',
    'cheese-wedge: جبنة|جبن|cheese',
    'egg: بيضة|بيض',
    'honey-pot: عسل|مرطبان عسل|honey',
    'glass-of-milk: حليب|كاسة حليب|لبن|milk',
    'meat-on-bone: لحم|لحمة|عظمة لحم|meat',
    'hamburger: برغر|همبرغر|برجر|burger',
    'french-fries: بطاطا مقلية|بطاطس مقلية|فرايز|fries',
    'pizza: بيتزا',
    'sandwich: ساندويش|سندويشة|شطيرة',
    'green-salad: سلطة|سلطه|فتوش|تبولة|salad',
    'pot-of-food: طبخة|قدر|طنجرة|شوربة|حساء|soup',
    'spaghetti: معكرونة|مكرونة|سباغيتي|pasta',
    'cooked-rice: رز|أرز|رز أبيض|rice',
    'popcorn: فشار|بوشار|بوب كورن',
    'birthday-cake: كعكة عيد ميلاد|عيد ميلاد|كيكة|كيك|كعكة|تورتة|cake|birthday',
    'cupcake: كب كيك|مافن|كعكة صغيرة',
    'pie: فطيرة|تارت',
    'doughnut: دونات|donut',
    'cookie: بسكويت|بسكوتة|كوكيز|كعكة محلاة',
    'chocolate-bar: شوكولاتة|شوكولا|شوكولاته|chocolate',
    'candy: حلوى|سكاكر|ملبس|سكرة|حلو|sweets',
    'lollipop: مصاصة|لولي بوب|حلوى عصا',
    'ice-cream: بوظة|آيس كريم|جيلاتي|مثلجات',
    'hot-beverage: قهوة|فنجان قهوة|نسكافيه|مشروب ساخن|coffee',
    'beverage-box: عصير|علبة عصير|juice',
    'baby-bottle: رضاعة|ببرونة|زجاجة رضاعة',
    'fork-and-knife-with-plate: صحن|طبق|وجبة|أكل|طعام|غداء|عشاء|food',
    'spoon: ملعقة|معلقة|خاشوقة',
  ],
  vehicles: [
    'automobile: سيارة|سياره|عربية|سيارات|car',
    'racing-car: سيارة سباق|سباق سيارات',
    'taxi: تاكسي|تكسي|سيارة أجرة',
    'police-car: سيارة شرطة|سيارة بوليس',
    'ambulance: إسعاف|سيارة إسعاف',
    'fire-engine: سيارة إطفاء|إطفائية|اطفائية',
    'bus: باص|حافلة|أوتوبيس',
    'delivery-truck: شاحنة توصيل|سيارة توصيل|van',
    'articulated-lorry: شاحنة|تريلا|كميون|truck|lorry',
    'sport-utility-vehicle: جيب|سيارة دفع رباعي|suv|jeep',
    'tractor: جرار|تراكتور|تركتور',
    'bicycle: دراجة|بسكليت|بسكلات|عجلة|دراجة هوائية|bike',
    'kick-scooter: سكوتر|سكوتر أطفال|scooter',
    'motor-scooter: فيسبا|دراجة نارية صغيرة',
    'motorcycle: دراجة نارية|موتور|موتوسيكل|ماطور|motorbike',
    'auto-rickshaw: توك توك|توكتوك|tuk tuk',
    'locomotive: قطار|قطار بخاري|ترين|train',
    'tram: ترام|ترامواي',
    'metro: مترو|قطار الأنفاق|subway',
    'airplane: طيارة|طائرة|plane',
    'helicopter: هليكوبتر|هيلوكبتر|مروحية',
    'parachute: باراشوت|مظلة هبوط',
    'sailboat: مركب شراعي|شراع|قارب شراعي|فلوكة',
    'ship: سفينة|باخرة|بابور',
    'motor-boat: قارب|زورق|لنش|boat',
    'anchor: مرساة|هلب',
    'fuel-pump: محطة وقود|كازية|بنزينة',
    'vertical-traffic-light: إشارة مرور|إشارة ضوئية|traffic light',
    'stop-sign: قف|إشارة قف|توقف',
    'wheel: دولاب|كفر|إطار',
  ],
  home: [
    'house: بيت|منزل|دار|home',
    'house-with-garden: بيت مع حديقة|فيلا|حديقة البيت|garden',
    'houses: بيوت|حي|حارة|منازل',
    'hospital: مستشفى|مشفى|مستشفي',
    'circus-tent: سيرك|خيمة السيرك|circus',
    'ferris-wheel: دولاب الهواء|عجلة دوارة|مدينة ملاهي',
    'carousel-horse: دوامة الخيل|خيول دوارة|كاروسيل',
    'playground-slide: زحليقة|زحلوقة|مزلقة|slide',
    'fountain: نافورة|بحرة',
    'bed: سرير|تخت',
    'chair: كرسي|كراسي',
    'door: باب|أبواب',
    'window: شباك|نافذة|شبابيك',
    'shower: دوش|دش|استحمام',
    'soap: صابون|صابونة',
    'toothbrush: فرشاة أسنان|فرشاية سنان',
    'broom: مكنسة|مقشة',
    'basket: سلة|قفة|سلال',
    'bucket: سطل|دلو|جردل',
    'key: مفتاح|مفاتيح',
    'locked: قفل|مقفل|lock',
    'light-bulb: لمبة|مصباح|ضو|ضوء|فكرة|lamp',
    'candle: شمعة|شمع',
    'alarm-clock: منبه|ساعة منبه',
    'mantelpiece-clock: ساعة|ساعة حائط|clock',
    'mobile-phone: موبايل|جوال|هاتف|خلوي|phone',
    'television: تلفزيون|تلفاز|شاشة|tv',
    'laptop: لابتوب|كمبيوتر|حاسوب|حاسوب محمول|computer',
    'camera: كاميرا|كمرة|آلة تصوير',
    'package: صندوق|علبة|كرتونة|طرد|box',
    'envelope: ظرف|مكتوب|رسالة|letter',
    'hammer: مطرقة|شاكوش',
    'screwdriver: مفك|مفك براغي',
    'toolbox: صندوق عدة|عدة|أدوات',
    'ladder: سلم|سلم خشب',
  ],
  clothes: [
    't-shirt: تيشيرت|قميص|بلوزة|shirt',
    'dress: فستان|فستانة|فساتين',
    'jeans: بنطلون|جينز|بنطال|pants',
    'socks: جرابات|كلسات|جوارب',
    'gloves: قفازات|كفوف|كلفوز',
    'scarf: شال|لفحة|وشاح',
    'coat: معطف|جاكيت|كبوت|jacket',
    'billed-cap: قبعة|طاقية|كاب|cap|hat',
    'running-shoe: حذاء رياضي|بوط|سبور|كندرة رياضية|sneaker',
    'mans-shoe: حذاء|كندرة|صباط|shoe',
    'thong-sandal: شبشب|شحاطة|زنوبة|نعال|flip flop',
    'sunglasses: نظارة شمسية|نظارات شمس',
    'glasses: نظارة|نظارات|عوينات',
  ],
  toys: [
    'teddy-bear: دبدوب|لعبة|ألعاب|toy|دبدوبة|دب محشو|دمية دب|teddy',
    'wrapped-gift: هدية|علبة هدية|gift|present',
    'balloon: بالون|بالونة|نفاخة|نفيخة',
    'party-popper: مفرقعة حفلة|حفلة|party',
    'ribbon: فيونكة|شريطة|عقدة شعر|bow',
    'kite: طائرة ورقية|طيارة ورق|طيارة ورقية',
    'yo-yo: يويو',
    'puzzle-piece: بازل|قطعة بازل|أحجية|puzzle',
    'piata: بينياتا|piñata',
    'game-die: نرد|زهر طاولة|حجر نرد|dice',
    'chess-pawn: شطرنج|بيدق|chess',
    'video-game: ألعاب فيديو|بلايستيشن|يد تحكم|controller',
  ],
  school: [
    'school: مدرسة|مدارس',
    'backpack: حقيبة|شنطة|شنطة مدرسة|حقيبة مدرسية|bag',
    'books: كتب|مكتبة|كتاب',
    'open-book: كتاب مفتوح|قراءة|reading',
    'notebook: دفتر|كراسة|دفاتر',
    'pencil: قلم رصاص|رصاص|قلم',
    'pen: قلم ناشف|قلم جاف|قلم أزرق',
    'crayon: قلم تلوين|تلوين|ألوان شمع|قلم شمع',
    'paintbrush: فرشاة رسم|فرشاية|ريشة رسم|brush',
    'artist-palette: لوحة الألوان|ألوان|باليت|رسم|paint|colors',
    'framed-picture: لوحة|صورة|برواز|picture',
    'straight-ruler: مسطرة',
    'triangular-ruler: مثلث هندسة|مسطرة مثلثة|كوس',
    'scissors: مقص|مقصات',
    'pushpin: دبوس|دبوس ضغط|دبابيس',
    'memo: ملاحظة|ورقة وقلم|كتابة|note',
    'page-facing-up: ورقة|صفحة|paper',
    'magnifying-glass-tilted-left: عدسة مكبرة|مكبرة|مكبر|بحث',
    'microscope: مجهر|ميكروسكوب',
    'test-tube: أنبوب اختبار|تجربة|مختبر',
    'world-map: خريطة|خريطة العالم|خارطة|map',
    'graduation-cap: قبعة تخرج|تخرج',
    'bell: جرس|جرس المدرسة|أجراس',
    'trophy: كأس|جائزة|كاس|بطولة|cup',
  ],
  music: [
    'musical-note: نوتة|نغمة|موسيقى|music',
    'musical-notes: نوتات|ألحان|أغنية|song',
    'guitar: جيتار|غيتار|قيثارة',
    'violin: كمان|كمنجة',
    'trumpet: بوق|ترومبيت',
    'saxophone: ساكسفون|ساكسوفون',
    'drum: طبل|طبلة|درامز',
    'maracas: ماراكاس|خشخيشة',
    'flute: ناي|فلوت|شبابة|مزمار',
    'musical-keyboard: بيانو|أورغ|كيبورد|piano',
    'microphone: ميكروفون|مايك|غناء|mic',
    'headphone: سماعات|سماعة رأس|هيدفون|headphones',
  ],
  sports: [
    'soccer-ball: كرة قدم|كرة|طابة|فوتبول|football|ball',
    'basketball: كرة سلة|باسكت',
    'tennis: تنس|كرة تنس|مضرب تنس',
    'volleyball: كرة طائرة|كرة طايرة|فولي',
    'ping-pong: تنس طاولة|بينغ بونغ',
    'goal-net: مرمى|غول|شبكة مرمى|goal',
    'skis: سكي|تزلج|زلاجات',
    'sled: مزلجة|زحافة|زلاجة ثلج|sledge',
    'skateboard: لوح تزلج|سكيت بورد|سكيت',
    'roller-skate: باتيناج|حذاء تزلج|زلاجات بعجلات',
    'flying-disc: فريزبي|قرص طائر|frisbee',
    'fishing-pole: صنارة|سنارة|صيد سمك|fishing',
    'bullseye: هدف|لوحة أسهم|دارتس|target',
    'boxing-glove: قفاز ملاكمة|ملاكمة|boxing',
    '1st-place-medal: ميدالية ذهبية|المركز الأول|الأول|gold medal',
    '2nd-place-medal: ميدالية فضية|المركز الثاني|الثاني',
    '3rd-place-medal: ميدالية برونزية|المركز الثالث|الثالث',
    'sports-medal: ميدالية|وسام|medal',
    'person-running: جري|ركض|عداء|running',
    'person-swimming: سباحة|سباح|يسبح|swimming',
    'person-biking: ركوب الدراجة|دراج|cycling',
    'person-cartwheeling: شقلبة|جمباز|gymnastics',
  ],
  fantasy: [
    'dragon: تنين|تنانين',
    'unicorn: يونيكورن|حصان بقرن|حصان سحري|حصان وحيد القرن',
    'phoenix-bird: عنقاء|طائر الفينيق|فينيق|phoenix',
    'castle: قلعة|قصر|قلاع',
    'crown: تاج|تيجان',
    'magic-wand: عصا سحرية|عصا الساحر|magic',
    'crystal-ball: كرة بلورية|كرة سحرية',
    'gem-stone: جوهرة|ماسة|ألماس|جواهر|diamond|jewel',
    'money-bag: كنز|كيس نقود|كيس ذهب|treasure',
    'coin: عملة|قطعة نقود|ليرة|قرش|مصاري|فلوس',
    'shield: درع|ترس الفارس',
    'diya-lamp: سراج|قنديل|مصباح علاء الدين|مصباح سحري',
    'ghost: شبح|طيف',
    'alien: فضائي|كائن فضائي',
    'robot: روبوت|رجل آلي|إنسان آلي',
    'person-fairy: جنية|جنية صغيرة|fairy',
    'person-mage: ساحر|ساحرة|wizard',
    'person-genie: جني|مارد|جني المصباح|genie',
    'person-merpeople: حورية البحر|عروس البحر|حورية|mermaid',
    'person-superhero: بطل خارق|سوبر هيرو|بطل|superhero',
    'prince: أمير|أمراء',
    'princess: أميرة|أميرات',
    'person-with-crown: ملك|ملكة|king|queen',
    'clown-face: مهرج|بلياتشو|clown',
  ],
  faces: [
    'grinning-face: وجه ضاحك|مبسوط|ضحكة',
    'smiling-face-with-smiling-eyes: سعيد|سعيدة|مبتسم|ابتسامة|happy',
    'grinning-squinting-face: ضحك|قهقهة|يضحك|laugh',
    'face-with-tears-of-joy: دموع الفرح|ضحك حتى البكاء|lol',
    'slightly-smiling-face: بسمة|ابتسامة خفيفة|smile',
    'winking-face: غمزة|يغمز|wink',
    'smiling-face-with-heart-eyes: معجب|عيون قلوب|إعجاب شديد',
    'star-struck: منبهر|مبهور|مبهورة',
    'face-savoring-food: لذيذ|طيب|يم|yummy',
    'face-with-tongue: لسان|يطلع لسانه',
    'nerd-face: شاطر|دحيح|ذكي|nerd',
    'smiling-face-with-sunglasses: كول|رايق|واثق|cool',
    'partying-face: محتفل|وجه حفلة',
    'thinking-face: يفكر|تفكير|مفكر|think',
    'hugging-face: عناق|حضن|يحضن|hug',
    'shushing-face: اسكت|هدوء|شش|shh',
    'flushed-face: خجلان|محرج|محرجة|shy',
    'frowning-face: حزين|حزينة|حزن|زعلان|sad',
    'sleepy-face: نعسان|نعس|sleepy',
    'sleeping-face: نائم|نوم|نايم|sleep',
    'yawning-face: تثاؤب|يتثاءب',
    'tired-face: تعبان|متعب|مرهق|tired',
    'crying-face: يبكي|بكاء|دمعة|cry',
    'loudly-crying-face: بكاء شديد|يبكي بشدة',
    'pleading-face: أرجوك|رجاء|عيون حزينة|please',
    'worried-face: قلق|قلقان|مهموم|worried',
    'fearful-face: خائف|خايف|خوف|scared',
    'face-screaming-in-fear: صراخ|مرعوب|رعب',
    'astonished-face: مندهش|مصدوم|دهشة|surprised',
    'face-with-open-mouth: متفاجئ|مفاجأة|واو|wow',
    'angry-face: غاضب|غاضبة|معصب|غضب|angry',
    'confused-face: محتار|حيران|مرتبك|confused',
    'cold-face: برد|بردان|متجمد|cold',
    'face-with-thermometer: مريض|سخنان|مرض|sick',
    'grinning-cat: قطة ضاحكة|بسة مبسوطة',
    'see-no-evil-monkey: قرد يغطي عيونه|لا أرى',
    'red-heart: قلب|قلب أحمر|حب|love|heart',
    'orange-heart: قلب برتقالي',
    'yellow-heart: قلب أصفر',
    'green-heart: قلب أخضر',
    'blue-heart: قلب أزرق',
    'purple-heart: قلب بنفسجي',
    'pink-heart: قلب وردي|قلب زهري',
    'broken-heart: قلب مكسور|قلب محطم',
    'speech-balloon: فقاعة كلام|كلام|حوار|محادثة',
    'thought-balloon: فقاعة تفكير|حلم|dream',
    'collision: انفجار|بوم|اصطدام|boom',
    'hundred-points: مية|مئة|علامة كاملة|100',
  ],
  gestures: [
    'thumbs-up: ممتاز|إعجاب|لايك|تمام|like',
    'thumbs-down: لا يعجبني|سيء|ديسلايك|dislike',
    'clapping-hands: تصفيق|صفقة|يصفق|clap',
    'waving-hand: مرحبا|أهلا|باي|مع السلامة|يلوح|hello|bye',
    'ok-hand: أوكي|اوك|ok',
    'victory-hand: علامة النصر|نصر|victory',
    'raised-hand: يد|كف|ارفع يدك|hand',
    'raising-hands: هيه|يرفع يديه|فرحة|hooray',
    'folded-hands: شكرا|من فضلك|thanks',
    'handshake: مصافحة|سلام باليد|اتفاق',
    'flexed-biceps: قوة|عضلات|قوي|strong',
    'index-pointing-up: إصبع لفوق|إشارة لفوق|انتباه',
    'crossed-fingers: بالتوفيق|حظ|تمني|luck',
    'eyes: عيون|عين|ينظر|يشوف|eye',
    'ear: أذن|اذن|اسمع',
    'nose: أنف|خشم|منخار',
    'mouth: فم|تم',
    'tooth: سن|أسنان|ضرس',
    'brain: دماغ|مخ|عقل',
    'footprints: آثار أقدام|خطوات|footsteps',
  ],
  people: [
    'baby: رضيع|بيبي|طفل رضيع|نونو',
    'child: طفل|أطفال|ولد صغير|kid',
    'boy: ولد|صبي|ولاد',
    'girl: بنت|فتاة|بنات|صبية',
    'man: رجل|زلمة|رجال',
    'woman: امرأة|ست|سيدة|مرة|نساء',
    'woman-with-headscarf: محجبة|حجاب|امرأة بحجاب|hijab',
    'person-wearing-turban: عمامة|رجل بعمامة|turban',
    'old-man: جد|جدو|سيدو|ختيار|grandpa',
    'old-woman: جدة|تيتا|ستي|ختيارة|grandma',
    'teacher: معلم|معلمة|مدرس|أستاذ|آنسة',
    'student: طالب|طالبة|تلميذ|تلميذة',
    'farmer: مزارع|فلاح|مزارعة',
    'cook: طباخ|شيف|طاهي|chef',
    'firefighter: إطفائي|رجل إطفاء',
    'police-officer: شرطي|شرطة|بوليس|police',
    'health-worker: طبيب|دكتور|ممرض|ممرضة|doctor',
    'astronaut: رائد فضاء|رائدة فضاء|فضاء|space',
    'pilot: طيار|كابتن',
    'scientist: عالم|عالمة|علوم',
    'artist: فنان|رسام|فنانة|رسامة',
    'singer: مغني|مطرب|مغنية|مطربة',
  ],
  arab: [
    'mosque: مسجد|جامع|مساجد',
    'kaaba: كعبة|الكعبة|مكة',
    'camel: جمل|ناقة|بعير|جمال|إبل',
    'two-hump-camel: جمل بسنامين|جمل بكتري',
    'palm-tree: نخلة|نخيل|نخل|palm',
    'desert: صحراء|صحرا|رمال|بر',
    'teapot: إبريق|إبريق شاي|براد',
    'teacup-without-handle: شاي|كاسة شاي|كأس شاي|استكانة|فنجان|tea',
    'mate: متة|كاسة متة',
    'falafel: فلافل|طعمية',
    'flatbread: خبز عربي|رغيف|كماج|مرقوق|خبز صاج|pita',
    'stuffed-flatbread: شاورما|شاورمة|عروس|لفة|shawarma',
    'shallow-pan-of-food: شكشوكة|مقلاة|عجة',
    'olive: زيتون|زيتونة|زيت زيتون',
    'folding-hand-fan: مروحة يد|مهفة|مروحة',
    'amphora: جرة|زير|جرة فخار',
  ],
  symbols: [
    'keycap-0: صفر|٠|0|zero',
    'keycap-1: واحد|١|1|one',
    'keycap-2: اثنان|اثنين|٢|2|two',
    'keycap-3: ثلاثة|تلاتة|٣|3|three',
    'keycap-4: أربعة|اربعة|٤|4|four',
    'keycap-5: خمسة|٥|5|five',
    'keycap-6: ستة|ستة|٦|6|six',
    'keycap-7: سبعة|٧|7|seven',
    'keycap-8: ثمانية|تمانية|٨|8|eight',
    'keycap-9: تسعة|٩|9|nine',
    'keycap-10: عشرة|١٠|10|ten',
    'plus: زائد|جمع|زايد',
    'minus: ناقص|طرح',
    'multiply: ضرب|ضرب في|times',
    'divide: قسمة|تقسيم',
    'heavy-equals-sign: يساوي|equals',
    'red-question-mark: سؤال|علامة استفهام|question',
    'red-exclamation-mark: علامة تعجب|تعجب',
    'check-mark-button: صح|صحيح|correct',
    'cross-mark: خطأ|غلط|إكس|wrong',
    'red-circle: دائرة|دائرة حمراء|circle',
    'blue-square: مربع|مربع أزرق|square',
    'red-triangle: مثلث|مثلث أحمر|triangle',
    'warning: تحذير|انتبه|خطر',
  ],
};

/** Name patterns that must never ship, whatever the list above says (the test repeats them). */
const EXCLUDED = [
  /-flag$|-flags$/u,
  /beer|wine|cocktail|sake|tumbler-glass|tropical-drink|bottle-with-popping-cork|clinking/u,
  /cigarette|smoking/u,
  /bomb|dagger|sword|pistol|^axe$|bow-and-arrow|kitchen-knife|military|water-pistol/u,
  /slot-machine|joker|mahjong|flower-playing-cards|pool-8-ball/u,
  /syringe|drop-of-blood|adhesive-bandage|pill|head-bandage|x-ray|coffin|headstone|funeral|skull/u,
  /^pig|^boar$|bacon/u,
  /church|latin-cross|orthodox-cross|synagogue|temple|shrine|menorah|^om$|khanda|star-of-david|wheel-of-dharma|prayer|santa|christmas|jack-o-lantern|hamsa|nazar/u,
  /kiss|bikini|briefs|lipstick|middle-finger|vomit|nauseated|woozy|pile-of-poo|horns|vampire|zombie|supervillain/u,
];

const TONES = /^(.+)-(light|medium-light|medium|medium-dark|dark)$/u;
const ARABIC = /[؀-ۿ]/u;

/* The library's own folding (stickers/catalog.ts): lower case, no tashkeel, one alef, ة → ه,
   ى → ي, Arabic digits → ASCII, words split on anything else and a leading ال dropped. */
function fold(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯؐ-ًؚ-ٰٟـ]/gu, '')
    .toLowerCase()
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي')
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 3 && word.startsWith('ال') ? word.slice(2) : word))
    .join(' ');
}

/** `name: word|word` lines → [{ name, group, words }] in list order. */
function curated() {
  const rows = [];
  for (const [group, lines] of Object.entries(STICKER_GROUPS)) {
    for (const line of lines) {
      const at = line.indexOf(':');
      if (at < 1) throw new Error(`${group}: malformed line "${line}"`);
      const name = line.slice(0, at).trim();
      const words = line
        .slice(at + 1)
        .split('|')
        .map((word) => word.trim())
        .filter((word) => word !== '');
      rows.push({ name, group, words });
    }
  }
  return rows;
}

/** Arabic words art-words.ts gives a Fluent name that heads a word group (its best match). */
function catalogWords() {
  const text = readFileSync(join(artCatalog, 'art-words.ts'), 'utf8');
  const words = new Map();
  for (const match of text.matchAll(/'([^'\n]*=>[^'\n]*)'/gu)) {
    const [synonyms = '', targets = ''] = match[1].split('=>');
    const first = targets.trim().split(/\s+/u)[0];
    if (first === undefined || first === '') continue;
    const arabic = synonyms
      .split('|')
      .map((word) => word.trim())
      .filter((word) => ARABIC.test(word));
    words.set(first, [...(words.get(first) ?? []), ...arabic]);
  }
  return words;
}

/** The AI catalog's view of the same data: its Flags category and its skin-toned people. */
function catalogEmoji() {
  const text = readFileSync(join(artCatalog, 'emoji.data.ts'), 'utf8');
  const flags = /Flags:\s*'([^']*)'/u.exec(text)?.[1]?.split(' ') ?? [];
  const toned = /EMOJI_TONED =\s*'([^']*)'/u.exec(text)?.[1]?.split(' ') ?? [];
  return { flags: new Set(flags), toned: new Set(toned) };
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(pack, 'package.json'), 'utf8'));
  const info = JSON.parse(readFileSync(join(pack, 'info.json'), 'utf8'));
  if (manifest.version !== VERSION || manifest.license !== 'MIT' || info.license?.spdx !== 'MIT') {
    throw new Error(`unexpected ${PACKAGE} ${manifest.version} (${manifest.license})`);
  }
  const icons = JSON.parse(readFileSync(join(pack, 'icons.json'), 'utf8'));
  const width = icons.width ?? 16;
  const height = icons.height ?? 16;
  const rows = curated();
  const { flags, toned } = catalogEmoji();
  const problems = [];
  const seen = new Set();
  for (const { name } of rows) {
    if (seen.has(name)) problems.push(`${name}: listed twice`);
    seen.add(name);
    if (icons.icons[name] === undefined) problems.push(`${name}: not in ${PACKAGE}`);
    const tone = TONES.exec(name);
    if (tone !== null && toned.has(tone[1])) problems.push(`${name}: a skin-tone variant`);
    if (flags.has(name) || EXCLUDED.some((pattern) => pattern.test(name))) {
      problems.push(`${name}: excluded`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join('\n'));

  // Words: every sticker's own name first, then our aliases, then the AI catalog's; first claim wins.
  const owner = new Map();
  for (const { name } of rows) owner.set(fold(name), name);
  const fromCatalog = catalogWords();
  const kept = new Map(rows.map(({ name }) => [name, []]));
  const dropped = [];
  const claim = (name, word) => {
    const key = fold(word);
    if (key === '') return;
    const holder = owner.get(key);
    if (holder === undefined) {
      owner.set(key, name);
      kept.get(name).push(word);
    } else if (holder !== name) {
      dropped.push(`${word} (${name} → ${holder})`);
    }
  };
  for (const { name, words } of rows) for (const word of words) claim(name, word);
  let added = 0;
  for (const { name } of rows) {
    for (const word of fromCatalog.get(name) ?? []) {
      const before = kept.get(name).length;
      claim(name, word);
      added += kept.get(name).length - before;
    }
  }

  const table = rows.map(({ name, group }) => {
    const icon = icons.icons[name];
    const body = icon.body;
    if (/<script|<foreignObject|\son\w+=|xlink:|href="(?!#)/iu.test(body))
      throw new Error(`${name}: unexpected markup`);
    return [name, group, kept.get(name).join('|'), icon.height ?? height, body];
  });
  if (table.some((row) => (icons.icons[row[0]].width ?? width) !== width)) {
    throw new Error('a sticker is not the set width');
  }
  const sha256 = createHash('sha256').update(JSON.stringify(table)).digest('hex');
  const counts = {};
  for (const { group } of rows) counts[group] = (counts[group] ?? 0) + 1;
  const moduleText = `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    node scripts/build-stickers-data.mjs

  ${table.length} stickers of Microsoft's Fluent Emoji Flat, unmodified SVG bodies on a ${width}-unit
  grid, from ${PACKAGE}@${VERSION} (Iconify JSON). Groups: ${Object.entries(counts)
    .map(([group, count]) => `${group} ${count}`)
    .join(', ')}.

  Fluent Emoji by Microsoft Corporation (https://github.com/microsoft/fluentui-emoji).
  MIT License, Copyright (c) Microsoft Corporation.
*/

export const FLUENT_EMOJI_FLAT_VERSION = ${JSON.stringify(VERSION)};

/** Every body's grid width (each row carries its own height, which is the same but for two). */
export const STICKER_GRID = ${width};

/** sha256 (hex) of the JSON of STICKER_ROWS. */
export const STICKER_ROWS_SHA256 = ${JSON.stringify(sha256)};

/** [name, group, words ('|'-separated, Arabic and English aliases), grid height, SVG body]. */
export const STICKER_ROWS: readonly (readonly [string, string, string, number, string])[] = ${JSON.stringify(table)};
`;
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  const formatted = await prettier.format(moduleText, { ...options, filepath: outFile });
  writeFileSync(outFile, formatted);
  console.log(
    `stickers: ${table.length} (${Object.entries(counts)
      .map(([group, count]) => `${group} ${count}`)
      .join(
        ', ',
      )}); ${added} catalog words added, ${dropped.length} words left with an earlier sticker; ` +
      `${formatted.length} bytes, ${gzipSync(formatted, { level: 9 }).length} gzip; sha256 ${sha256}`,
  );
  if (process.argv.includes('--verbose')) console.log(dropped.join('\n'));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
