/**
 * View fixtures for the decision surfaces (WP-13: PagePlanCard and its parts, StepPlanCard,
 * ProposalCard, RestoreDialog), for their stories and tests only.
 *
 * Plans are made the way the product makes them: an engine candidate, through the engine's
 * own `validatePagePlan` (`validatedPlan`), into a draft by `draftFromEnginePagePlan`, and
 * into a `PlanView` by the model's `planFields`. So a story shows a plan a build can
 * actually receive, and "Edited", "invalid" and the limits come from the same code the
 * controller runs, not from flags set by hand.
 *
 * `useLivePlan` is the controller's plan path in miniature: it applies each op with the
 * model's `applyPlanOp`, answers `accepts` by the same identity check (a refused op returns
 * the same draft), and says what LiveStatus would say after a move or a removal
 * (`plan.moved`, `plan.removed`). Interactive stories and the reorder tests run through it.
 */
import type { PagePlan, PagePlanCandidate } from '@craftkit/builder';
import { useCallback, useRef, useState } from 'react';

import { tAnnounce } from '../copy';
import {
  applyPlanOp,
  createPlanDraft,
  draftFromEnginePagePlan,
  planFields,
  type PagePlanDraft,
} from '../model/page-plan-draft';
import type {
  ChangeLineView,
  Locale,
  PlanNote,
  PlanOp,
  PlanView,
  ProposalView,
  StepPlanView,
} from '../model/view-types';

import { validatedPlan } from './page-plans';

/* ── The dental-clinic plan of SPEC §3.7, in both languages ─────────────────── */

interface SectionCopy {
  readonly key: string;
  readonly role: 'header' | 'hero' | 'band' | 'footer';
  readonly anchorId: string;
  readonly title: Readonly<Record<Locale, string>>;
  readonly purpose: Readonly<Record<Locale, string>>;
}

/** SPEC §3.7's eight sections, §3.14's purposes, §3.15's Arabic titles. */
const DENTAL_SECTIONS: readonly SectionCopy[] = [
  {
    key: 'header',
    role: 'header',
    anchorId: 'top',
    title: { en: 'Header', ar: 'الترويسة' },
    purpose: { en: 'Logo, 4 links, booking', ar: 'الشعار وأربعة روابط وزر الحجز' },
  },
  {
    key: 'hero',
    role: 'hero',
    anchorId: 'hero',
    title: { en: 'Hero', ar: 'الواجهة' },
    purpose: { en: 'Promise + book button', ar: 'وعد العيادة وزر الحجز' },
  },
  {
    key: 'services',
    role: 'band',
    anchorId: 'services',
    title: { en: 'Services', ar: 'الخدمات' },
    purpose: { en: 'Implants, braces, more', ar: 'زراعة وتقويم وتبييض' },
  },
  {
    key: 'why-us',
    role: 'band',
    anchorId: 'why-us',
    title: { en: 'Why us', ar: 'لماذا نحن' },
    purpose: { en: 'Three reasons to trust the clinic', ar: 'ثلاثة أسباب للثقة بالعيادة' },
  },
  {
    key: 'doctors',
    role: 'band',
    anchorId: 'doctors',
    title: { en: 'Doctors', ar: 'الأطباء' },
    purpose: { en: 'The dentists and their specialties', ar: 'الأطباء وتخصصاتهم' },
  },
  {
    key: 'testimonials',
    role: 'band',
    anchorId: 'testimonials',
    title: { en: 'Testimonials', ar: 'آراء المرضى' },
    purpose: { en: 'Patients in their own words', ar: 'تجارب المرضى بكلماتهم' },
  },
  {
    key: 'faq',
    role: 'band',
    anchorId: 'faq',
    title: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
    purpose: { en: 'Prices, insurance, first visit', ar: 'الأسعار والتأمين والزيارة الأولى' },
  },
  {
    key: 'contact',
    role: 'footer',
    anchorId: 'contact',
    title: { en: 'Contact', ar: 'التواصل' },
    purpose: { en: 'Address, hours, WhatsApp', ar: 'العنوان والدوام وواتساب' },
  },
];

const SUBJECT: Readonly<Record<Locale, string>> = {
  en: 'Dental clinic, Amman',
  ar: 'عيادة أسنان، عمّان',
};

/** The plan's signature, which the card shows as its mood line. */
const MOOD: Readonly<Record<Locale, string>> = {
  en: 'Calm, clinical, teal',
  ar: 'هادئ، طبّي، فيروزي',
};

/**
 * Measured, not hoped: ink #0e1116 on #f5fafa and white reads 18:1 and more, muted #475569
 * 7.3:1 and more, and white on the teal #0f766e 5.48:1, so the teal also reads as text
 * (5.24:1 on the ground) and the engine derives `accentInk` from it.
 */
export function dentalPlanCandidate(locale: Locale): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang: locale },
    title: SUBJECT[locale],
    description:
      locale === 'ar'
        ? 'عيادة أسنان في عمّان، والحجز عبر واتساب.'
        : 'A dental clinic in Amman with WhatsApp booking.',
    tokens: {
      bg: '#f5fafa',
      surface: '#ffffff',
      ink: '#0e1116',
      muted: '#475569',
      accent: '#0f766e',
      onAccent: '#ffffff',
      border: '#dbe7e7',
      fontDisplay: { family: 'Reem Kufi', weights: [500, 700] },
      fontBody: { family: 'IBM Plex Sans Arabic', weights: [400, 600] },
      radius: 'xl',
      signature: MOOD[locale],
    },
    primaryCta: {
      label: locale === 'ar' ? 'احجز عبر واتساب' : 'Book on WhatsApp',
      href: '#contact',
    },
    nav: DENTAL_SECTIONS.filter(({ key }) => ['services', 'doctors', 'faq'].includes(key)).map(
      (section) => ({ label: section.title[locale], anchorId: section.anchorId }),
    ),
    sections: DENTAL_SECTIONS.map((section) => ({
      key: section.key,
      role: section.role,
      title: section.title[locale],
      anchorId: section.anchorId,
      purpose: section.purpose[locale],
    })),
    facts: [{ key: 'phone', sample: '+962 79 000 0000', section: 'contact' }],
  };
}

/** The dental plan as the engine hands it over: validated and frozen. */
export function dentalPlan(locale: Locale): PagePlan {
  return validatedPlan(dentalPlanCandidate(locale));
}

/** The dental plan as the card edits it (SPEC §7.6 E6 and E7 present). */
export function dentalDraft(locale: Locale): PagePlanDraft {
  return draftFromEnginePagePlan(dentalPlan(locale));
}

/** The dental section titles, in page order. */
export function dentalTitles(locale: Locale): readonly string[] {
  return DENTAL_SECTIONS.map((section) => section.title[locale]);
}

/* ── PlanView fixtures ──────────────────────────────────────────────────────── */

/** The PlanView fields the controller sets itself (turn, status, mode, note). */
export interface PlanFrame {
  readonly turnId?: string;
  readonly status?: PlanView['status'];
  readonly approval?: boolean;
  readonly editable?: boolean;
  readonly note?: PlanNote;
}

/** A PlanView of `draft`, edited or not against `original`, as the controller builds it. */
export function planViewOf(
  original: PagePlanDraft,
  draft: PagePlanDraft = original,
  frame: PlanFrame = {},
): PlanView {
  return {
    turnId: frame.turnId ?? 'turn-plan',
    status: frame.status ?? 'ready',
    approval: frame.approval ?? false,
    editable: frame.editable ?? true,
    note: frame.note ?? 'exact',
    ...planFields(original, draft),
  };
}

/** Every op applied in turn, each through the model; a refused op fails the fixture loudly. */
function edited(draft: PagePlanDraft, ops: readonly PlanOp[]): PagePlanDraft {
  return ops.reduce((current, op) => {
    const next = applyPlanOp(current, op);
    if (next === current) throw new Error(`fixture op refused: ${JSON.stringify(op)}`);
    return next;
  }, draft);
}

/** SPEC §3.7: the plan as it arrives in Plan mode. */
export function planReady(locale: Locale, frame: PlanFrame = {}): PlanView {
  const draft = dentalDraft(locale);
  return planViewOf(draft, draft, frame);
}

/** After a rename (§3.7 "Patient stories") and a move: the "Edited" tag. */
export function planEdited(locale: Locale, frame: PlanFrame = {}): PlanView {
  const original = dentalDraft(locale);
  const draft = edited(original, [
    {
      kind: 'rename',
      key: 'testimonials',
      title: locale === 'ar' ? 'قصص المرضى' : 'Patient stories',
    },
    { kind: 'move', key: 'faq', to: 3 },
  ]);
  return planViewOf(original, draft, frame);
}

/** Text a grey that cannot be read on white: Build refuses, the swatches say why. */
export function planLowContrast(locale: Locale, frame: PlanFrame = {}): PlanView {
  const original = dentalDraft(locale);
  const draft = edited(original, [{ kind: 'setToken', role: 'text', hex: '#a3acb9' }]);
  return planViewOf(original, draft, frame);
}

/** Two sections named alike, so one link could not tell them apart. */
export function planDuplicateTitle(locale: Locale, frame: PlanFrame = {}): PlanView {
  const original = dentalDraft(locale);
  const draft = edited(original, [
    { kind: 'rename', key: 'faq', title: locale === 'ar' ? 'الخدمات' : 'Services' },
  ]);
  return planViewOf(original, draft, frame);
}

/** Ask mode's approval: the same card, tagged "Waiting for your approval". */
export function planApproval(locale: Locale, frame: PlanFrame = {}): PlanView {
  return planReady(locale, { approval: true, ...frame });
}

/**
 * SPEC §7.6 E6/E7 absent (`capabilities.editablePlan = false`): titles and the direction
 * prose only. Plan mode re-plans at Build, so its note says the page may differ; in Ask the
 * held question builds exactly these sections.
 */
export function planReadOnly(locale: Locale, note: PlanNote, frame: PlanFrame = {}): PlanView {
  const draft = createPlanDraft({
    subject: SUBJECT[locale],
    sections: DENTAL_SECTIONS.map((section) => section.title[locale]),
    direction:
      locale === 'ar'
        ? 'هادئ وطبّي، بلون فيروزي وخط كوفي للعناوين'
        : 'Calm and clinical, a teal accent and a Kufi face for headings',
  });
  return planViewOf(draft, draft, { editable: false, note, ...frame });
}

/** A plan at the engine's floor: two sections, so none can be removed. */
export function planAtMinimum(locale: Locale, frame: PlanFrame = {}): PlanView {
  const draft = createPlanDraft({
    subject: SUBJECT[locale],
    sections: locale === 'ar' ? ['الواجهة', 'التواصل'] : ['Hero', 'Contact'],
    direction: {
      mood: MOOD[locale],
      swatches: dentalDraft(locale).direction?.swatches,
      fontPairId: 'reem-kufi--ibm-plex-sans-arabic',
    },
  });
  return planViewOf(draft, draft, frame);
}

const EXTRA_SECTIONS: Readonly<Record<Locale, readonly string[]>> = {
  en: ['Pricing', 'Gallery', 'Insurance', 'Map'],
  ar: ['الأسعار', 'معرض الصور', 'التأمين', 'الخريطة'],
};

/** A plan at the engine's ceiling: twelve sections, so none can be added. */
export function planAtMaximum(locale: Locale, frame: PlanFrame = {}): PlanView {
  const titles = dentalTitles(locale);
  const draft = createPlanDraft({
    subject: SUBJECT[locale],
    sections: [...titles.slice(0, -1), ...EXTRA_SECTIONS[locale], ...titles.slice(-1)],
    direction: {
      mood: MOOD[locale],
      swatches: dentalDraft(locale).direction?.swatches,
      fontPairId: 'reem-kufi--ibm-plex-sans-arabic',
    },
  });
  return planViewOf(draft, draft, frame);
}

/** The plan while the planner writes it: a working record, not yet a card. */
export function planDrafting(locale: Locale): PlanView {
  return { ...planReady(locale), status: 'drafting' };
}

/* ── The controller's plan path, for interactive stories and tests ─────────── */

export interface LivePlan {
  readonly view: PlanView;
  /** `AgentController.editPlan`: applies the op through the model, announces moves. */
  readonly edit: (turnId: string, op: PlanOp) => void;
  /** Whether the plan would take `op` (the model does not return the same draft). */
  readonly accepts: (op: PlanOp) => boolean;
  /** What LiveStatus would say last, or `null`. */
  readonly announcement: string | null;
}

/**
 * A plan the card can really edit: each op goes through `applyPlanOp`, a refused op changes
 * nothing, and a move or a removal is announced the way SPEC §4.3 words it.
 */
export function useLivePlan(
  locale: Locale,
  initial: PagePlanDraft,
  frame: PlanFrame = {},
): LivePlan {
  const [original] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  // The newest draft, for an op that arrives before the re-render of the one before it.
  const latest = useRef(initial);

  const edit = useCallback(
    (_turnId: string, op: PlanOp) => {
      const current = latest.current;
      const next = applyPlanOp(current, op);
      if (next === current) return;
      latest.current = next;
      setDraft(next);
      if (op.kind === 'move') {
        const index = next.sections.findIndex((section) => section.key === op.key);
        const title = next.sections[index]?.title ?? '';
        setAnnouncement(
          tAnnounce(locale, 'plan.moved', { title, i: index + 1, n: next.sections.length }),
        );
      } else if (op.kind === 'remove') {
        const title = current.sections.find((section) => section.key === op.key)?.title ?? '';
        setAnnouncement(tAnnounce(locale, 'plan.removed', { title }));
      }
    },
    [locale],
  );

  const accepts = useCallback((op: PlanOp) => applyPlanOp(latest.current, op) !== latest.current, []);

  return { view: planViewOf(original, draft, frame), edit, accepts, announcement };
}

/* ── ProposalView fixtures (SPEC §3.8, §4.13) ───────────────────────────────── */

const FAQ_HEADING: Readonly<Record<Locale, ChangeLineView>> = {
  en: { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
  ar: {
    kind: 'changed',
    label: 'العنوان',
    before: 'الأسئلة الشائعة',
    after: 'أسئلة يطرحها المرضى',
  },
};

const FAQ_BUTTON: Readonly<Record<Locale, ChangeLineView>> = {
  en: { kind: 'added', label: 'Button', value: 'Book on WhatsApp' },
  ar: { kind: 'added', label: 'الزر', value: 'احجز عبر واتساب' },
};

const FAQ_TARGET: Readonly<Record<Locale, string>> = {
  en: 'FAQ',
  ar: 'الأسئلة الشائعة',
};

/** SPEC §3.8: a proposed change, boxed until answered; the page has not changed. */
export function proposalPending(
  locale: Locale,
  overrides: Partial<ProposalView> = {},
): ProposalView {
  return {
    turnId: 'turn-proposal',
    status: 'ready',
    target: FAQ_TARGET[locale],
    changes: [FAQ_HEADING[locale]],
    pageUnchanged: true,
    previewing: false,
    menu: ['viewAsCode'],
    ...overrides,
  };
}

/** Validation dropped one of three changes: an Amber line says how many survived. */
export function proposalPartial(locale: Locale): ProposalView {
  return proposalPending(locale, {
    changes: [FAQ_HEADING[locale], FAQ_BUTTON[locale]],
    partial: { kept: 2, total: 3 },
  });
}

/** Shown on the canvas through `previewAiPlan`; the document itself is untouched. */
export function proposalPreviewing(locale: Locale): ProposalView {
  return proposalPending(locale, { previewing: true });
}

/** A proposal whose run wrote to the page: the honesty line is no longer true. */
export function proposalWrote(locale: Locale): ProposalView {
  return proposalPending(locale, { pageUnchanged: false });
}

/** A page-wide proposal: no target to name. */
export function proposalPageWide(locale: Locale): ProposalView {
  return proposalPending(locale, {
    target: undefined,
    changes: [
      locale === 'ar'
        ? {
            kind: 'changed',
            label: 'اتجاه الصفحة',
            before: 'من اليسار إلى اليمين',
            after: 'من اليمين إلى اليسار',
          }
        : {
            kind: 'changed',
            label: 'Page direction',
            before: 'Left to right',
            after: 'Right to left',
          },
    ],
  });
}

/** While the model prepares the proposal: a working record. */
export function proposalDrafting(locale: Locale): ProposalView {
  return proposalPending(locale, { status: 'drafting', changes: [], menu: [] });
}

/* ── StepPlanView fixtures (SPEC §4.12) ─────────────────────────────────────── */

/** Plan mode's answer to an edit request: three read-only steps, each naming its block. */
export function stepsReady(locale: Locale): StepPlanView {
  return {
    turnId: 'turn-steps',
    status: 'ready',
    steps:
      locale === 'ar'
        ? [
            {
              key: 'step-1',
              text: 'تغيير العنوان إلى «أسئلة يطرحها المرضى»',
              target: 'الأسئلة الشائعة',
            },
            { key: 'step-2', text: 'إضافة زر واتساب تحت الإجابات', target: 'الأسئلة الشائعة' },
            { key: 'step-3', text: 'تثبيت الترويسة أعلى الصفحة أثناء التمرير', target: 'الترويسة' },
          ]
        : [
            {
              key: 'step-1',
              text: 'Rename the heading to “Questions patients ask”',
              target: 'FAQ',
            },
            { key: 'step-2', text: 'Add a WhatsApp button under the answers', target: 'FAQ' },
            { key: 'step-3', text: 'Keep the header at the top while scrolling', target: 'Header' },
          ],
  };
}

/** A step with no target block: a page-wide step. */
export function stepsPageWide(locale: Locale): StepPlanView {
  return {
    turnId: 'turn-steps',
    status: 'ready',
    steps: [
      {
        key: 'step-1',
        text:
          locale === 'ar'
            ? 'جعل اتجاه الصفحة من اليمين إلى اليسار'
            : 'Set the page to read right to left',
      },
    ],
  };
}

/** While the model drafts the steps: a working record. */
export function stepsDrafting(): StepPlanView {
  return { turnId: 'turn-steps', status: 'drafting', steps: [] };
}
