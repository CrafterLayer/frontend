/**
 * Whether a request ASKS for page code — custom JavaScript, a custom PixiJS
 * scene, moving characters, a game (free code mode, 2026-10-09).
 *
 * The prompt uses it for ONE thing, and only while the composer's free-code
 * switch is off: a single per-request line after the cached prefix
 * (`FREE_CODE_OFF_HINT`) that tells the model to point the person at the
 * switch and build the closest closed motion scene instead of refusing («هذا
 * يحتاج صفحة برمجية خارج المحرر»). With the switch on the card is sent
 * whatever the words say, so nothing here runs.
 *
 * Deterministic and cheap, in the style of `prefersScriptServer`: the request
 * is folded with the same `foldIntentText`, then a few rules decide. A
 * request that is not matched costs nothing and a false positive costs one
 * line the model can ignore, so the rules lean toward words that name code
 * (JavaScript, Pixi, WebGL, "custom scene", "write code", "moving characters",
 * "make a game") and away from words a page also uses for design ("script"
 * font, "canvas" background, a "game store").
 */
import { foldIntentText } from './script-intent';

// ── English ──────────────────────────────────────────────────────────────────

// The engines and the language by name.
const EN_TECH =
  /\b(?:pixi(?:\s?js)?|webgl|three\s?js|babylon\s?js|p5\s?js|phaser|java\s?script|js|glsl|shaders?|sprites?|html5 canvas|canvas\s+(?:game|animation|scene))\b/u;

// "custom / bespoke / own" + a thing only code makes.
const EN_CUSTOM =
  /\b(?:custom|bespoke|own)\s+(?:java\s?script|js|scripts?|code|scene|game|physics|webgl|canvas)\b/u;

// Asking for code itself.
const EN_CODE =
  /\b(?:write|code|program)\s+(?:me\s+)?(?:some\s+|a\s+|the\s+|my\s+)?(?:code|scripts?|java\s?script)\b|\b(?:with|using|via|in)\s+(?:custom\s+)?(?:code|java\s?script)\b(?!\s+(?:blocks?|snippets?|fonts?|style|styling|format))|\bprogrammatic(?:ally)?\b/u;

// Characters that move: "moving characters", "characters that walk".
const EN_CHARACTERS =
  /\b(?:moving|animated|walking|running|flying|jumping|dancing)\s+(?:characters?|sprites?|creatures?|figures?|mascots?|robots?|monsters?|animals?|people|fish|birds?)\b|\bcharacters?\s+(?:that\s+|which\s+)?(?:move|moves|walk|walks|run|runs|fly|flies|jump|jumps|dance|dances)\b/u;

// A 3D scene or viewer.
const EN_3D = /\b3d\s+(?:scene|world|model|viewer|game|environment)\b/u;

// A game, but not a business that sells or reviews them.
const EN_GAME =
  /\b(?:interactive|playable|browser|html5|arcade|mini|simple|small)\s+games?\b|\b(?:make|build|create|code|write|develop|program|add|design)\s+(?:me\s+)?(?:a|an|the|my)?\s*(?:[a-z0-9-]+\s+){0,2}games?\b(?!\s+(?:store|shop|studio|company|review|reviews|news|blog|site|website|page|club|cafe|center|centre|rental|room|night|lounge))/u;

// ── Arabic (folded: ة→ه, أ/إ/آ→ا, ى→ي) ──────────────────────────────────────

// The engines and the language by name: جافاسكربت، بيكسي، سكربت.
const AR_TECH = /(?:جافا\s?سكر(?:يبت|بت)|(?:^|\s)جافا(?=\s|$)|بيكسي|بكسي|سكر(?:يبت|بت)|شيدر)/u;

// كود مخصص، سكربت مخصص، اكتب لي كود، بالكود، برمج.
const AR_CODE =
  /(?:كود|سكر(?:يبت|بت))\s+(?:مخصص|خاص|برمجي|جافا)|(?:اكتب|اكتبلي|برمج|ابرمج)\s*(?:لي\s+|لنا\s+)?(?:كود|سكر(?:يبت|بت)|برمجه)|(?:^|\s)(?:بالكود|برمج|برمجه|برمجي|ابرمج)(?=\s|$)/u;

// شخصيات متحركة / تتحرك / تمشي.
const AR_CHARACTERS =
  /شخصي(?:ات|ه)\s+(?:متحرك(?:ه|ات)?|تتحرك|تمشي|تركض|تطير|تقفز|ترقص)|(?:كائنات|مخلوقات|حيوانات)\s+(?:متحركه|تتحرك|تمشي|تركض|تطير)/u;

// مشهد مخصص / برمجي / ثلاثي الأبعاد (a plain «مشهد متحرك» is the closed scene tool).
const AR_SCENE = /مشهد\s+(?:مخصص|برمجي|ثلاثي|ثري\s?دي|3d)/u;

// اعمل لعبة، لعبة تفاعلية، ألعاب تفاعلية.
const AR_GAME =
  /(?:اعمل|اصنع|انشئ|ابني|اضف|سوي|اكتب|صمم|برمج|ابغي|ابي|بدي|اريد|عايز|عاوز)\s+(?:لي\s+|لنا\s+)?(?:\S+\s+){0,2}لعبه|لعبه\s+(?:تفاعليه|بسيطه|صغيره|داخل|في\s+(?:الصفحه|الموقع))|العاب\s+تفاعليه/u;

/** True when the request asks for page JavaScript, a custom PixiJS scene, moving characters or a game. */
export function asksForFreeCode(request: string): boolean {
  const text = foldIntentText(request);
  if (text === '') return false;
  return (
    EN_TECH.test(text) ||
    EN_CUSTOM.test(text) ||
    EN_CODE.test(text) ||
    EN_CHARACTERS.test(text) ||
    EN_3D.test(text) ||
    EN_GAME.test(text) ||
    AR_TECH.test(text) ||
    AR_CODE.test(text) ||
    AR_CHARACTERS.test(text) ||
    AR_SCENE.test(text) ||
    AR_GAME.test(text)
  );
}
