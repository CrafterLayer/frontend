import { systemClock, type BuilderKernel } from '@craftkit/builder-core';

import { normalizeIntentText } from '../../intent/normalize-arabic';
// media-motion (2026-10-06): zero-token media readings (DESIGN §F.3)
import { readMedia } from '../../media-tools/direct-media';
import { validateAiPlan } from '../../plan/validate-plan';
import { checkSeo } from '../../seo/check-seo';
import type { AiPlan, AiValidationPorts } from '../../types';
import { verifiedFamily } from './builtin/fonts-set';
import { colourOf } from './colour-words';
import { readElementColour } from './element-colour';
import { expandAgentTools } from './expand';
import { rootChildren } from './shared';
import { AGENT_TOOL_COMMAND, type AgentToolStep } from './types';
import { planChangesLook } from './visible-change';

/**
 * Zero-token tools: a request that says EXACTLY one of a few things —
 * «غيّر اللون إلى الأخضر», "use font Cairo", «حسّن السيو», «احذف قسم الأسعار»,
 * "move Menu above Story", «حدّث القائمة», «اجعل الصفحة عربية» — becomes its
 * tool step here, with no model. The step is expanded and validated like any
 * model's; anything that does not match in full, or does not expand, or does
 * not pass the door, returns undefined and the model path runs as before.
 *
 * Words are folded by `normalizeIntentText` (أ/إ/آ→ا, ة→ه, ى→ي, harakat and
 * tatweel dropped, lower case), so each rule is written once.
 */

export interface DirectToolResult {
  readonly plan: AiPlan;
  /** One line in the request's language: the plan's history label. */
  readonly label: string;
  /**
   * What the tool could not fix safely and the owner must decide (a sample
   * phone in the business data, a missing city, an unset slug), as the
   * checks word them. Also appended to the plan's rationale. SEO only.
   */
  readonly remaining?: readonly string[];
}

interface ToolCall {
  readonly name: string;
  readonly input: Record<string, unknown>;
}

interface Reading {
  readonly calls: readonly ToolCall[];
  /** Ordinary kernel steps, for a reading no tool expresses (one element's colour). */
  readonly steps?: readonly AgentToolStep[];
  readonly label: { readonly ar: string; readonly en: string };
  /** After the plan is judged: the issues the tools leave for the owner. */
  readonly remaining?: (kernel: BuilderKernel) => readonly string[];
}

const MAX_REQUEST_CHARS = 160;
const ARABIC = /[؀-ۿ]/u;

// ── Colours ───────────────────────────────────────────────────────────────────

// COLOUR_WORDS and colourOf live in colour-words.ts, shared with the element-colour reading.

const AR_VERB = '(?:غير|غيري|بدل|بدلي|خلي|خل|اجعل|حول|اعمل|صير)';
const COLOUR_AR = new RegExp(
  `^${AR_VERB}\\s+(?:ال)?(?:لون|الوان)(?:\\s+(?:ال)?(?:موقع|صفحه|رئيسي|اساسي|براند|ثيم))?\\s+(?:(?:الي|الى|ل)\\s+)?(\\S+)$`,
  'u',
);
const COLOUR_EN =
  /^(?:change|make|set|switch|turn)\s+(?:the\s+)?(?:(?:site|page|brand|main|primary|accent|theme)\s+)?colou?rs?\s+(?:to\s+|into\s+)?([a-z]+)$/u;
const COLOUR_EN_IT = /^(?:make|turn)\s+(?:it|the\s+(?:site|page))\s+([a-z]+)$/u;

function readColour(text: string): Reading | undefined {
  const word =
    COLOUR_AR.exec(text)?.[1] ?? COLOUR_EN.exec(text)?.[1] ?? COLOUR_EN_IT.exec(text)?.[1];
  const accent = word === undefined ? undefined : colourOf(word);
  if (accent === undefined) return undefined;
  return {
    calls: [{ name: 'theme.apply', input: { accent } }],
    label: { ar: 'تغيير لون الصفحة', en: 'Change the page colour' },
  };
}

// ── Fonts ─────────────────────────────────────────────────────────────────────

const FONT_AR = new RegExp(
  `^(?:(?:${AR_VERB.slice(3, -1)}|استخدم|استعمل)\\s+)?(?:ال)?خط(?:\\s+(?:ال)?(?:موقع|صفحه))?\\s+(?:(?:الي|الى|ل)\\s+)?([a-z][a-z0-9 ]+)$`,
  'u',
);
const FONT_EN =
  /^(?:use|set|change|switch)\s+(?:the\s+)?(?:font|typeface)\s+(?:to\s+)?([a-z][a-z0-9 ]+)$/u;
const FONT_EN_TAIL = /^use\s+(?:the\s+)?([a-z][a-z0-9 ]+?)\s+font$/u;

function readFont(text: string): Reading | undefined {
  const name = FONT_AR.exec(text)?.[1] ?? FONT_EN.exec(text)?.[1] ?? FONT_EN_TAIL.exec(text)?.[1];
  const family = name === undefined ? undefined : verifiedFamily(name);
  if (family === undefined) return undefined;
  return {
    calls: [{ name: 'fonts.set', input: { display: family, body: family } }],
    label: { ar: `استخدام خط ${family}`, en: `Use the ${family} font` },
  };
}

// ── SEO ───────────────────────────────────────────────────────────────────────

const SEO_AR =
  /^(?:حسن|حسنلي|تحسين|ظبط|اضبط|صلح|اصلح)\s+(?:ال)?(?:سيو|seo)(?:\s+(?:لل|ال)?(?:صفحه|موقع))?$/u;
const SEO_EN =
  /^(?:(?:improve|fix|optimi[sz]e|boost)\s+(?:the\s+)?seo(?:\s+(?:of\s+)?(?:the\s+)?(?:page|site))?|seo)$/u;

/** The checks `seo.meta` answers itself, so they are never left for the owner. */
const META_CHECKS: ReadonlySet<string> = new Set(['seo-title', 'seo-description']);
const REMAINING_MAX = 5;

/**
 * «حسّن السيو» is the FULL safe pass (final test 2026-09-30: it set only the
 * social title and description): `seo.fix` applies every safe fix — alt text,
 * image hints, headings, section labels AND the structured-data kinds the
 * content backs (FAQPage, Menu, Product) — then `seo.meta` fits the title and
 * description. What neither can fix safely is reported, not guessed.
 */
function readSeo(text: string): Reading | undefined {
  if (!SEO_AR.test(text) && !SEO_EN.test(text)) return undefined;
  return {
    calls: [
      { name: 'seo.fix', input: {} },
      { name: 'seo.meta', input: {} },
    ],
    label: { ar: 'تحسين السيو', en: 'Improve SEO' },
    remaining: (kernel) =>
      checkSeo(kernel.getDocument())
        .filter((issue) => issue.fix?.safe !== true && !META_CHECKS.has(issue.check))
        .map((issue) => issue.message)
        .slice(0, REMAINING_MAX),
  };
}

// ── Sections ──────────────────────────────────────────────────────────────────

/** Folded, with a leading Arabic article dropped: «الأسعار» and «أسعار» name one section. */
function nameKey(text: string): string {
  return normalizeIntentText(text)
    .replace(/^(?:the\s+)/u, '')
    .split(' ')
    .map((word) => word.replace(/^ال(?=\S{2,})/u, ''))
    .join(' ');
}

/** The ONE root section whose label is this name, or undefined. */
function sectionNamed(
  kernel: BuilderKernel,
  name: string,
): { readonly id: string; readonly label: string } | undefined {
  const wanted = nameKey(name);
  const document = kernel.getDocument();
  const hits = rootChildren(kernel).flatMap((id) => {
    const label = document.nodes[id]?.props['label'];
    return typeof label === 'string' && nameKey(label) === wanted ? [{ id, label }] : [];
  });
  return hits.length === 1 ? hits[0] : undefined;
}

const SECTION_AR = '(?:(?:ال)?(?:قسم|سكشن|جزء)\\s+)';
const DELETE_AR = new RegExp(`^(?:احذف|احذفي|امسح|شيل|ازل|الغي)\\s+${SECTION_AR}(.+)$`, 'u');
const DELETE_EN = /^(?:delete|remove)\s+(?:the\s+)?(?:section\s+(.+)|(.+?)\s+section)$/u;
const MOVE_AR = new RegExp(
  `^(?:انقل|حرك|ارفع|نزل)\\s+${SECTION_AR}?(.+?)\\s+(فوق|قبل|تحت|بعد)\\s+${SECTION_AR}?(.+)$`,
  'u',
);
const MOVE_EN =
  /^move\s+(?:the\s+)?(.+?)(?:\s+section)?\s+(above|before|below|after|under)\s+(?:the\s+)?(.+?)(?:\s+section)?$/u;

function readSections(text: string, kernel: BuilderKernel): Reading | undefined {
  const deleted = DELETE_AR.exec(text);
  const deletedEn = DELETE_EN.exec(text);
  const doomed = deleted?.[1] ?? deletedEn?.[1] ?? deletedEn?.[2];
  if (doomed !== undefined) {
    const section = sectionNamed(kernel, doomed);
    if (section === undefined) return undefined;
    return {
      calls: [{ name: 'section.ops', input: { op: 'remove', id: section.id } }],
      label: { ar: `حذف قسم «${section.label}»`, en: `Delete the “${section.label}” section` },
    };
  }
  const moved = MOVE_AR.exec(text) ?? MOVE_EN.exec(text);
  if (moved === null) return undefined;
  const section = sectionNamed(kernel, moved[1] ?? '');
  const anchor = sectionNamed(kernel, moved[3] ?? '');
  if (section === undefined || anchor === undefined || section.id === anchor.id) return undefined;
  const before = ['فوق', 'قبل', 'above', 'before'].includes(moved[2] ?? '');
  return {
    calls: [
      {
        name: 'section.ops',
        input: { op: 'move', id: section.id, to: `${before ? 'before' : 'after'}:${anchor.id}` },
      },
    ],
    label: {
      ar: `نقل «${section.label}» ${before ? 'فوق' : 'تحت'} «${anchor.label}»`,
      en: `Move “${section.label}” ${before ? 'above' : 'below'} “${anchor.label}”`,
    },
  };
}

// ── Menu and direction ────────────────────────────────────────────────────────

const NAV_AR =
  /^(?:حدث|زامن|رتب|جدد)\s+(?:ال)?(?:قائمه|قايمه|منيو|روابط)(?:\s+(?:ال)?(?:علويه|رئيسيه|تنقل))?$/u;
const NAV_EN =
  /^(?:sync|update|refresh|rebuild)\s+(?:the\s+)?(?:menu|menus|nav|navigation|links)$/u;

function readNav(text: string): Reading | undefined {
  if (!NAV_AR.test(text) && !NAV_EN.test(text)) return undefined;
  return {
    calls: [{ name: 'nav.sync', input: {} }],
    label: { ar: 'تحديث القائمة', en: 'Sync the menu' },
  };
}

const PAGE_AR = '(?:ال)?(?:صفحه|موقع)';
const RTL_AR = new RegExp(
  `^(?:اجعل|خلي|حول|صير)\\s+${PAGE_AR}\\s+(?:(?:الي|الى|ل)\\s*)?(?:ال|لل)?(?:عربي|عربيه|rtl)$`,
  'u',
);
const LTR_AR = new RegExp(
  `^(?:اجعل|خلي|حول|صير)\\s+${PAGE_AR}\\s+(?:(?:الي|الى|ل)\\s*)?(?:ال|لل)?(?:انجليزي|انجليزيه|انكليزي|انكليزيه|ltr)$`,
  'u',
);
const RTL_EN =
  /^(?:(?:make|switch|turn)\s+(?:the\s+)?(?:page|site|it)\s+(?:to\s+|into\s+)?|switch\s+to\s+)?(?:rtl|arabic|right to left)$/u;
const LTR_EN =
  /^(?:(?:make|switch|turn)\s+(?:the\s+)?(?:page|site|it)\s+(?:to\s+|into\s+)?|switch\s+to\s+)(?:ltr|english|left to right)$/u;

function readDirection(text: string): Reading | undefined {
  if (RTL_AR.test(text) || RTL_EN.test(text)) {
    return {
      calls: [{ name: 'direction.set', input: { lang: 'ar' } }],
      label: { ar: 'تحويل الصفحة إلى العربية', en: 'Make the page Arabic (RTL)' },
    };
  }
  if (LTR_AR.test(text) || LTR_EN.test(text)) {
    return {
      calls: [{ name: 'direction.set', input: { lang: 'en' } }],
      label: { ar: 'تحويل الصفحة إلى الإنجليزية', en: 'Make the page English (LTR)' },
    };
  }
  return undefined;
}

// ── Entry ─────────────────────────────────────────────────────────────────────

const COURTESY =
  /(?:\s+(?:من فضلك|لو سمحت|لو سمحتي|please|pls|thanks|thank you))+$|^(?:(?:please|pls|لو سمحت|من فضلك)\s+)/gu;

function folded(request: string): string {
  return normalizeIntentText(request)
    .replace(/[.!?,;:،؛؟]+$/u, '')
    .replace(COURTESY, '')
    .trim();
}

let dryRunIds = 0;
const DRY_RUN_PORTS: AiValidationPorts = {
  clock: systemClock,
  ids: {
    newId: () => {
      dryRunIds += 1;
      return `direct-tool-${String(dryRunIds)}`;
    },
  },
};

/**
 * The request as a validated tool plan with no model, or undefined. Reads
 * the document and dry-runs the plan through the door; never writes.
 */
export function tryDirectTool(
  request: string,
  kernel: BuilderKernel,
): DirectToolResult | undefined {
  const trimmed = request.trim();
  if (trimmed === '' || trimmed.length > MAX_REQUEST_CHARS || /[\r\n]/u.test(trimmed))
    return undefined;
  const text = folded(trimmed);
  // colour-target fix: a colour that names an element («سارة», «العنوان», "the button") is that element's, read first.
  const element = readElementColour(text, kernel);
  const reading: Reading | undefined =
    (element === undefined ? undefined : { calls: [], steps: element.steps, label: element.label }) ??
    readColour(text) ??
    readFont(text) ??
    readSeo(text) ??
    readNav(text) ??
    readDirection(text) ??
    readSections(text, kernel) ??
    // media-motion (2026-10-06): «ضيف معرض صور», «حط فيديو <url>», «خلفية متحركة» … (URLs read from the typed request)
    readMedia(text, kernel, trimmed);
  if (reading === undefined) return undefined;
  const label = ARABIC.test(trimmed) ? reading.label.ar : reading.label.en;
  const candidate = {
    rationale: label,
    commands: [
      ...(reading.steps ?? []),
      ...reading.calls.map(({ name, input }) => ({
        command: AGENT_TOOL_COMMAND,
        args: { name, input },
      })),
    ],
  };
  let expanded: ReturnType<typeof expandAgentTools>;
  try {
    expanded = expandAgentTools(candidate, kernel);
  } catch {
    return undefined;
  }
  if (expanded.issues.length > 0) return undefined;
  const commands =
    (expanded.plan as { commands?: readonly { command?: unknown }[] }).commands ?? [];
  if (commands.length === 0 || commands.some((step) => step.command === AGENT_TOOL_COMMAND))
    return undefined;
  const verdict = validateAiPlan(expanded.plan, kernel, DRY_RUN_PORTS);
  if (!verdict.ok) return undefined;
  /*
    colour-target fix: never «عُدِّلت الصفحة» for a page that looks the same. A
    kit rewrite that only regroups the font imports, or recolours a token no
    element reads, is not an edit; the model decides instead.
  */
  if (!planChangesLook(verdict.plan.commands, kernel)) return undefined;
  const remaining = reading.remaining?.(kernel) ?? [];
  if (remaining.length === 0) return Object.freeze({ plan: verdict.plan, label });
  const left = ARABIC.test(trimmed) ? 'يبقى لك' : 'Left for you';
  return Object.freeze({
    plan: { ...verdict.plan, rationale: `${label}. ${left}: ${remaining.join(' ')}` },
    label,
    remaining,
  });
}
