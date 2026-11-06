/*
  Animal names for `s.lib.animals` (animal art, 2026-11-05): the 29 heads of Kenney's Animal
  Pack Remastered by their English ids, and the words a story is likely to use for them, in
  English and in Arabic (MSA and Levantine). Arabic is compared without diacritics or tatweel,
  with every alef form folded to ا, ة to ه and ى to ي, and without a leading ال, so «الدُّبّ»,
  «دب» and «دبّ» all find the bear. Unknown words are reported with the closest real names.
*/

import { ANIMAL_FRAMES } from './atlas.generated';

export const ANIMAL_NAMES: readonly string[] = Object.freeze(Object.keys(ANIMAL_FRAMES).sort());

/** Other words for each animal. Arabic is written plainly; `normalize` folds the variants. */
const WORDS: Readonly<Record<string, readonly string[]>> = {
  bear: ['teddy', 'teddybear', 'دب', 'دبدوب', 'دبة'],
  buffalo: ['bison', 'ox', 'bull', 'جاموس', 'جاموسة', 'بيسون', 'ثور'],
  chick: ['babychick', 'صوص', 'صوصو', 'صيصان', 'كتكوت', 'فرخ'],
  chicken: ['hen', 'rooster', 'cockerel', 'دجاجة', 'دجاج', 'جاجة', 'ديك'],
  cow: ['calf', 'cattle', 'بقرة', 'بقر', 'عجل', 'عجلة'],
  crocodile: ['croc', 'alligator', 'gator', 'تمساح'],
  dog: ['puppy', 'doggy', 'doggo', 'pup', 'husky', 'كلب', 'كلبة', 'جرو'],
  duck: ['duckling', 'mallard', 'بطة', 'بط'],
  elephant: ['فيل', 'فيلة'],
  frog: ['toad', 'froggy', 'ضفدع', 'ضفدعة', 'ضفدعه', 'ضفضع'],
  giraffe: ['زرافة'],
  goat: ['billygoat', 'nannygoat', 'ماعز', 'عنزة', 'عنز', 'معزة', 'معزاية', 'تيس', 'جدي'],
  gorilla: ['ape', 'غوريلا', 'غوريللا', 'غورلا'],
  hippo: ['hippopotamus', 'فرس النهر', 'فرس البحر', 'سيد قشطة'],
  horse: ['pony', 'stallion', 'mare', 'حصان', 'فرس', 'خيل', 'مهر'],
  monkey: ['chimp', 'chimpanzee', 'قرد', 'قردة', 'سعدان', 'نسناس'],
  moose: ['elk', 'موظ', 'أيل', 'ايل'],
  narwhal: ['نروال', 'ناروال', 'حريش البحر', 'كركدن البحر'],
  owl: ['owlet', 'بومة', 'بوم', 'بوه'],
  panda: ['باندا', 'پاندا', 'دب الباندا'],
  parrot: ['macaw', 'parakeet', 'ببغاء', 'ببغا', 'بغبغان', 'بباغ'],
  penguin: ['بطريق', 'بطريقة', 'بنغوين', 'بينغوين', 'بطريء'],
  rabbit: ['bunny', 'hare', 'أرنب', 'أرنوب', 'أرانب', 'أرنبة'],
  rhino: ['rhinoceros', 'وحيد القرن', 'كركدن', 'خرتيت'],
  sloth: ['كسلان', 'حيوان الكسلان', 'سلوث'],
  snake: ['serpent', 'cobra', 'python', 'أفعى', 'ثعبان', 'حية', 'حنش'],
  walrus: ['فظ', 'فيل البحر'],
  whale: ['orca', 'killerwhale', 'حوت', 'أوركا', 'حوت قاتل'],
  zebra: ['حمار وحشي', 'حمار مخطط', 'زيبرا', 'زرد'],
};

/** Lower case, no spaces or punctuation; Arabic folded as the header says. */
export function normalize(word: string): string {
  const folded = word
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي')
    .replace(/پ/gu, 'ب')
    .replace(/[\s_'’.-]+/gu, '');
  return folded.startsWith('ال') && folded.length > 3 ? folded.slice(2) : folded;
}

const INDEX: ReadonlyMap<string, string> = (() => {
  const index = new Map<string, string>();
  for (const name of ANIMAL_NAMES) index.set(normalize(name), name);
  for (const [name, words] of Object.entries(WORDS)) {
    for (const word of words) {
      const key = normalize(word);
      // Phrases keep their inner ال ("فرس النهر"); match both with and without it.
      index.set(key, name);
      index.set(key.replace(/ال/gu, ''), name);
    }
  }
  return index;
})();

/** The animal a word names (English or Arabic), or undefined. */
export function findAnimal(word: unknown): string | undefined {
  if (typeof word !== 'string') return undefined;
  const key = normalize(word);
  if (key === '') return undefined;
  const direct = INDEX.get(key) ?? INDEX.get(key.replace(/ال/gu, ''));
  if (direct !== undefined) return direct;
  // English plurals: "pandas", "foxes" style endings.
  if (key.endsWith('es') && INDEX.has(key.slice(0, -2))) return INDEX.get(key.slice(0, -2));
  if (key.endsWith('s')) return INDEX.get(key.slice(0, -1));
  return undefined;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j] ?? 0;
      row[j] = Math.min(next + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length] ?? 0;
}

/** Up to three animals whose names or words are close to `word` (an edit or two away). */
export function closeAnimals(word: string): string[] {
  const key = normalize(word);
  const limit = Math.max(1, Math.min(3, Math.floor(key.length / 3)));
  const scored = new Map<string, number>();
  for (const [candidate, name] of INDEX) {
    const d = distance(key, candidate);
    if (d <= limit && d < (scored.get(name) ?? Infinity)) scored.set(name, d);
  }
  return [...scored]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name]) => name);
}

/** The canonical name, or a TypeError naming close matches (or every animal there is). */
export function animalName(word: unknown, caller: string): string {
  const name = findAnimal(word);
  if (name !== undefined) return name;
  if (typeof word !== 'string') {
    throw new TypeError(`animals.${caller} needs an animal name, e.g. 'panda' or 'باندا'`);
  }
  const close = closeAnimals(word);
  throw new TypeError(
    close.length > 0
      ? `animals.${caller}: unknown animal "${word}"; did you mean ${close.join(', ')}?`
      : `animals.${caller}: unknown animal "${word}"; the animals are ${ANIMAL_NAMES.join(', ')}`,
  );
}
