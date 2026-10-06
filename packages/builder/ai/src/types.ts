import type {
  ClockPort,
  BlockPropertyKind,
  BlockPropertyTab,
  Breakpoint,
  ContextFragment,
  IdPort,
  JsonValue,
  NodeId,
  SlotName,
} from '@craftkit/builder-schema';

import type { IntentKind } from './intent/route-intent';
import type { AiSkillActivationPin, AiSkillManifestV1 } from './skills';

export interface AiBlockSlotContext {
  name: SlotName;
  allow: readonly string[];
  max?: number;
}

export interface AiBlockExampleContext {
  prompt: string;
  node: JsonValue;
}

/** Compact, lossless-for-AI summary of block-declared Inspector intent. */
export interface AiBlockPropertyIntentContext {
  /** Properties grouped by their content/design/advanced decision surface. */
  tabs: Readonly<Partial<Record<BlockPropertyTab, readonly string[]>>>;
  /** Only explicitly declared semantic control kinds; undeclared kinds are never inferred. */
  kinds: Readonly<Partial<Record<BlockPropertyKind, readonly string[]>>>;
}

/**
 * One registered block as the model sees it.
 *
 * `type` and `description` are the IDENTITY and always present: a mode that
 * hid them would hide the block's existence, and a vocabulary the model cannot
 * name is a block that may as well not be registered.
 *
 * Everything below them is DETAIL, and detail is what costs. Measured on the
 * playground's landing fixture, the 54-block catalog serialized to 57,851 of
 * the request's 61,578 tokens — 94% — because every block shipped its full
 * JSON Schema, examples, and slot table whether or not the request touched it.
 * The detail fields are therefore optional, present exactly when the run's
 * `AiCatalogMode` says this block is in scope. Read them with a guard.
 */
export interface AiBlockContext {
  type: string;
  description: string;
  /**
   * Whether this run may INSERT a node of this type. Absent means yes.
   *
   * Two cases say no. The document's ROOT type (a `page`) can never be
   * inserted into itself, in any mode. And a presence entry in `none` mode
   * carries prop NAMES without a schema: it is there so an existing block can
   * be edited, not authored — inserting one would mean inventing its props.
   * Both were learned the same way: a run spent six minutes and came back
   * "Slot default of root accepts [...], not page".
   */
  insertable?: boolean;
  /**
   * The prop names a block ALREADY ON THE PAGE accepts — present in `none`
   * mode for exactly those types, and nothing more. "Make the hero title
   * bigger" is the most common ask there is; without the names the model
   * invented a `size` prop the door then rejected. Names cost ~30 tokens a
   * block; the schema would cost ~1,000. Values are inferred from the props
   * the document already shows.
   */
  propKeys?: readonly string[];
  /** Present in `full` mode, and in `scoped` mode for the scoped types. */
  propsSchema?: JsonValue;
  /** Declared design/Inspector intent grouped to avoid repeating section chrome on the wire. */
  propertyIntents?: AiBlockPropertyIntentContext;
  /** Present in `full` mode, and in `scoped` mode for the scoped types. */
  examples?: readonly AiBlockExampleContext[];
  /** Present in `full` mode, and in `scoped` mode for the scoped types. */
  slots?: readonly AiBlockSlotContext[];
}

export interface AiDocumentNodeContext {
  id: NodeId;
  type: string;
  /**
   * The node's full props, for EVERY node — not only the selection. "Change
   * the word X" names content, not a node id; a provider can only find that
   * word if the document context actually contains the page's text.
   */
  props: Readonly<Record<string, JsonValue>>;
  /** Current data bindings, when the node has any. */
  bindings?: Readonly<Record<string, string>>;
  /** Current instance-level widget skin override. */
  variantOf?: string;
  /** Current non-desktop property overrides, detached from the live document. */
  responsive?: Readonly<Partial<Record<Breakpoint, Readonly<Record<string, JsonValue>>>>>;
  slots: Readonly<Record<SlotName, readonly NodeId[]>>;
}

export interface AiDocumentContext {
  schemaVersion: number;
  surface: string;
  dir: 'ltr' | 'rtl';
  rootId: NodeId;
  nodes: readonly AiDocumentNodeContext[];
}

/** Kept for source compatibility; selected details resolve through the canonical document nodes. */
export type AiSelectedNodeContext = AiDocumentNodeContext;

export interface AiSelectionContext {
  ids: readonly NodeId[];
}

/** A registered page/template composition that AI may insert atomically. */
export interface AiTemplateContext {
  id: string;
  name: string;
  rootType: string;
  nodeCount: number;
  blockTypes: readonly string[];
}

/** One command the model may propose in this exact run. */
export interface AiCommandContext {
  name: string;
  argsSchema: JsonValue;
}

export interface AiPlanOutputContract {
  version: 1;
  schema: JsonValue;
}

export interface AiContextOmission {
  source: 'commands';
  reason: 'policy-filtered';
  omittedCount: number;
}

export interface AssembledAiContext {
  fragments: readonly ContextFragment[];
  totalTokens: number;
  blocks: readonly AiBlockContext[];
  /** Optional for backwards-compatible provider fixtures created outside the assembler. */
  templates?: readonly AiTemplateContext[];
  document: AiDocumentContext;
  selection: AiSelectionContext;
  /** Additive for compatibility; the assembler always supplies all three readiness fields. */
  commands?: readonly AiCommandContext[];
  outputContract?: AiPlanOutputContract;
  omissions?: readonly AiContextOmission[];
  /** Progressive-disclosure metadata; never contains instruction/reference bodies. */
  skillCatalog?: readonly AiSkillManifestV1[];
  /** Version/fingerprint pins only. Full bodies live exactly once in `fragments`. */
  skills?: readonly AiSkillActivationPin[];
  /**
   * How the page this plan lands on gets CSS for a class: `tailwind` when the
   * host compiles any Tailwind utility at runtime (see `setUtilityClassOracle`),
   * absent when only the static utility vocabulary is generated. The prompt
   * tells the model which, so it is never held to a list that no longer binds.
   */
  utilities?: 'tailwind';
  /**
   * The client reads a custom-code tree written as markup (see tree-markup.ts)
   * — so the prompt may ask for markup, which is a third shorter than the
   * nested tree and has no closers to miscount. Absent on older clients.
   */
  treeMarkup?: true;
}

export interface AiPlanStep {
  command: string;
  args: unknown;
  /**
   * Optional human sentence for this step, written by the provider in the
   * requester's own language ("إضافة قسم الأسعار", "Recolour the hero"). A UI
   * shows this instead of the raw command name; the command stays the truth
   * the kernel executes.
   */
  title?: string;
}

export interface AiPlan {
  rationale: string;
  commands: readonly AiPlanStep[];
  /**
   * Optional staged-work suggestion: when a request is too big for one safe
   * plan, the provider does the most valuable stage now and words the NEXT
   * request here, in the requester's language. A UI offers it as a one-tap
   * continuation; nothing applies it automatically.
   */
  followUp?: string;
}

/** One prior exchange in the conversation the request belongs to. */
export interface AiChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Live options for one proposal. `signal` cancels the work for real — a
 * provider must stop, not merely ignore the answer — and surfaces as the
 * platform's AbortError, never as a provider failure. `onProgress` carries the
 * provider's own words about what it is doing right now, for a UI to show
 * while the person waits. `history` is the conversation so far, so "make it
 * blue" can mean the hero the previous turn just added.
 */
export interface AiProposeOptions {
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
  history?: readonly AiChatTurn[];
}

/** The provider boundary. A network-backed provider implements the same contract. */
export interface AiPlanProvider {
  propose(
    request: string,
    context: AssembledAiContext,
    options?: AiProposeOptions,
  ): Promise<AiPlan>;
  /**
   * Optional one-shot second chance: called with the rejected plan and its
   * validation issues when the first proposal fails the kernel door. The
   * repaired plan is validated exactly like the first; there is no third try.
   */
  repair?(
    request: string,
    context: AssembledAiContext,
    plan: AiPlan,
    issues: readonly AiPlanValidationIssue[],
    options?: AiProposeOptions,
  ): Promise<AiPlan>;
  /**
   * Optional: this proposal did NOT pass the door, so do not answer with it
   * again. Called by `generateAiPlan` the moment validation rejects a plan.
   *
   * It exists because a provider cannot know whether its own answer was any
   * good — validation happens on the far side of this boundary. A caching
   * provider that stores every answer will replay a rejected one for free on
   * an identical ask, so the person who retries a failing request watches it
   * fail faster, forever, with no model involved. Synchronous and
   * best-effort: a provider without a memory implements nothing.
   */
  forget?(request: string, context: AssembledAiContext, options?: AiProposeOptions): void;
  /**
   * Optional: answer with a PAGE PLAN — the structured, editable design of a
   * whole page (tokens, fonts, one contract per section) — instead of kernel
   * commands. It is step T1 of the page build (agent-audit §3.1): Plan mode
   * stops after it and shows the plan; Build consumes it verbatim.
   *
   * Optional so every provider written before it still satisfies the port —
   * a host that finds it missing falls back to the scaffold build. What comes
   * back is UNTRUSTED model output: only `validatePagePlan` turns it into a
   * `PagePlan`, exactly as only the kernel door turns an `AiPlan` into writes.
   *
   * A refusal throws the provider's refusal error, as `propose` does. On the
   * remote wire this is `task: 'page-plan'` on the same endpoint (wire.ts).
   */
  proposePagePlan?(
    request: string,
    context: AssembledAiContext,
    options?: AiProposePagePlanOptions,
  ): Promise<AiPagePlanProposal>;
  /**
   * Optional: rewrite a person's DRAFT before it runs — spelling and spacing
   * fixed in its own language, an edit made explicit, a build turned into a
   * short professional brief — and name what is missing as 0–3 questions.
   * Nothing is written and nothing is built: the answer goes back into the
   * composer for the person to read (the ✨ Improve action, owner request
   * 2026-09-28, after «هل يمكنك تربط ال صفحه هاي داخل عليها» was taken
   * literally).
   *
   * Optional like every capability added after `propose`: a provider without
   * it leaves `enhanceRequest` (prompt-enhance/) on its deterministic tidy.
   * On the remote wire this is `POST <origin>/v1/prompt/enhance` (wire.ts).
   */
  enhancePrompt?(
    input: AiPromptEnhanceInput,
    options?: AiEnhancePromptOptions,
  ): Promise<AiPromptEnhancement>;
}

// ── The prompt enhancer (2026-09-28): the contract both sides implement ──────

/** The two languages the panel speaks; a draft's own language is one of them. */
export type AiPromptLocale = 'ar' | 'en';

/** What the intent router made of the draft, when it ran: kind and 0–1 confidence. */
export interface AiPromptEnhanceIntent {
  readonly kind: IntentKind;
  readonly confidence: number;
}

/** What the page holds right now, as the enhancer is told it (≤ 20 section labels). */
export interface AiPromptEnhancePage {
  readonly empty: boolean;
  readonly sections: readonly string[];
}

/** One answered clarifying question, folded into the rewrite on the next call. */
export interface AiPromptEnhanceAnswer {
  readonly question: string;
  readonly answer: string;
}

/**
 * The draft and what surrounds it — the enhance request body minus `version`.
 * `locale` is the UI's language (the language `understood` and `changes` are
 * written in); the rewrite itself stays in the draft's own language.
 */
export interface AiPromptEnhanceInput {
  readonly text: string;
  readonly locale: AiPromptLocale;
  readonly intent: AiPromptEnhanceIntent | null;
  readonly page: AiPromptEnhancePage;
  /** The selected block's label, or null with nothing selected. */
  readonly selection: string | null;
  readonly answers: readonly AiPromptEnhanceAnswer[];
}

/** One question the enhancer needs answered before it can rewrite without guessing. */
export interface AiPromptEnhanceQuestion {
  readonly id: string;
  readonly text: string;
  /** 2–4 short choices in the draft's language; a person may still type their own. */
  readonly choices: readonly string[];
}

/** The enhance answer — the response body minus `version`. */
export interface AiPromptEnhancement {
  /** The rewritten request, in the draft's own language and script. */
  readonly enhanced: string;
  /** One sentence in the UI locale: what the enhancer understood. */
  readonly understood: string;
  /** At most 5 short items in the UI locale: what was changed. */
  readonly changes: readonly string[];
  /** 0–3; empty unless essential information is missing or the draft is ambiguous. */
  readonly questions: readonly AiPromptEnhanceQuestion[];
  /** The draft's language. */
  readonly language: AiPromptLocale;
}

/** Live options for one enhance call: `signal` cancels it for real, as in `propose`. */
export interface AiEnhancePromptOptions {
  signal?: AbortSignal;
}

/**
 * One reason a page plan was refused, phrased as the instruction that repairs
 * it ("tokens.muted: #a8a29e on bg #ffffff is 2.52:1; body text needs 4.5:1 —
 * pick a darker muted"). `path` names the field the way the model wrote it:
 * `sections[2].anchorId`, `tokens.fontBody.weights[1]`.
 */
export interface PagePlanIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * A page plan as a provider returned it: a JSON object nobody has checked.
 * Typed as an open record rather than as `PagePlan` because the type would be
 * a lie until `validatePagePlan` has run.
 */
export type PagePlanCandidate = Readonly<Record<string, unknown>>;

/** A provider's page-plan answer. */
export interface AiPagePlanProposal {
  readonly pagePlan: PagePlanCandidate;
  /** One or two sentences on the direction, in the requester's language. */
  readonly rationale?: string;
}

/**
 * The previous candidate and why it was refused, sent back once for repair —
 * the page-plan twin of `AiPlanProvider.repair`'s `(plan, issues)`.
 */
export interface AiPagePlanAttempt {
  readonly pagePlan: PagePlanCandidate;
  readonly issues: readonly PagePlanIssue[];
}

/**
 * The raw text of a page-plan answer while the model is still writing it
 * (the `draft` SSE frame, wire.ts `AiPlanWireDraft`). `start`: a (new)
 * response began — forget any earlier text. `text`: the next raw slice of the
 * model's answer, in order. Advisory only: the resolved proposal is the
 * authority, and a provider that does not stream emits nothing.
 */
export type AiPagePlanDraftEvent =
  { readonly kind: 'start' } | { readonly kind: 'text'; readonly text: string };

export interface AiProposePagePlanOptions extends AiProposeOptions {
  /** Present on the one repair call; absent on the first proposal. */
  attempt?: AiPagePlanAttempt;
  /**
   * Observer of the streamed answer text (see `AiPagePlanDraftEvent`).
   * Advisory only: the resolved proposal is the authority. Observer errors are
   * swallowed by the provider and never change the call's outcome.
   */
  onDraft?: (event: AiPagePlanDraftEvent) => void;
}

/** Dedicated deterministic capabilities for preflight; never borrow the live kernel's instances. */
export interface AiValidationPorts {
  clock: ClockPort;
  ids: IdPort;
}

export interface AiPlanValidationIssue {
  code: 'invalid-plan' | 'unknown-command' | 'invalid-args' | 'policy-rejected' | 'door-rejected';
  message: string;
  step?: number;
}

export type AiPlanValidationResult =
  { ok: true; plan: AiPlan } | { ok: false; issues: readonly AiPlanValidationIssue[] };
