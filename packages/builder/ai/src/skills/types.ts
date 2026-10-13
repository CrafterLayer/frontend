import type { IntentKind } from '../intent/route-intent';

export type AiSkillSource = 'builtin' | 'host';

export type AiSkillTrust = 'builtin' | 'reviewed' | 'untrusted';

/**
 * A writing system a request can be recognised by.
 *
 * Keywords match PHRASES; a script matches the LANGUAGE. The Arabic/RTL skill
 * used to fire only when the request happened to contain one of its listed
 * imperatives ("صمم لي") and stayed silent on every other Arabic request — the
 * same page type got different expertise depending on the verb used. A script
 * is what "the request is in Arabic" actually means.
 */
export type AiSkillScript = 'arabic' | 'latin';

export type AiSkillActivation =
  | Readonly<{ mode: 'explicit' }>
  | Readonly<{ mode: 'always' }>
  | Readonly<{
      mode: 'auto';
      /**
       * Whole words of the request, matched as the intent router reads it:
       * folded (case, hamza, taa marbuta, alif maqsura, tashkeel, Latin
       * accents), Arabic clitics peeled ("لعيادتي" holds "عيادة"), a keyword's
       * last word taking its usual endings ("animated", "bakeries", "عقارية"),
       * never matched inside another word ("eid al" is not in "Reid Allen").
       */
      keywords?: readonly string[];
      selectedBlockTypes?: readonly string[];
      /** Activate when the request is written in any of these scripts. */
      scripts?: readonly AiSkillScript[];
      /**
       * A GATE, not a trigger: when present, the triggers above count only for
       * a request that routes to one of these intents (`routeIntent`). A page
       * archetype declares `['build-page', 'build-site']` so the trade noun in
       * "Change the restaurant menu prices" no longer loads a whole-page
       * playbook into an edit. Absent: every intent, as before.
       */
      intents?: readonly IntentKind[];
    }>;

/**
 * Versioned, data-only expertise supplied to the AI planning layer.
 *
 * A skill can narrow planning authority, but it cannot add commands or execute
 * code. V1 deliberately has no script, URL, import, process, network, or
 * filesystem capability.
 */
export interface AiSkillDefinitionV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  instructions: string;
  tags?: readonly string[];
  source?: AiSkillSource;
  trust?: AiSkillTrust;
  activation?: AiSkillActivation;
  /** Higher values win when more than one optional auto skill matches. */
  priority?: number;
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  restrictToCommands?: readonly string[];
  references?: Readonly<Record<string, string>>;
}

export interface AiSkillManifestV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  tags: readonly string[];
  source: AiSkillSource;
  trust: AiSkillTrust;
  activation: AiSkillActivation;
  priority: number;
  dependencies: readonly string[];
  conflicts: readonly string[];
  restrictToCommands?: readonly string[];
  referencePaths: readonly string[];
  contentFingerprint: string;
}

export interface AiDefinedSkillV1 {
  readonly manifest: AiSkillManifestV1;
  readonly instructions: string;
  readonly references: Readonly<Record<string, string>>;
}

export type AiSkillActivationReason = 'explicit' | 'always' | 'dependency' | 'auto';

export interface AiSkillActivationPin {
  id: string;
  version: string;
  contentFingerprint: string;
  reason: AiSkillActivationReason;
}

export interface AiActiveSkillContext extends AiSkillActivationPin {
  name: string;
  description: string;
  instructions: string;
  references: readonly Readonly<{ path: string; content: string }>[];
  restrictToCommands?: readonly string[];
}

/**
 * Why a skill was left out. `'intent'`: an auto skill's DEPENDENCY whose own
 * `activation.intents` excludes the request's route — the page taste skill
 * under a one-section request — left out while the skill that needs it
 * activates (router-3, 2026-09-28).
 */
export type AiSkillOmissionCode =
  'active-limit' | 'conflict' | 'intent' | 'token-budget' | 'untrusted';

export interface AiSkillOmission {
  id: string;
  code: AiSkillOmissionCode;
  message: string;
}

export interface AiSkillPrepareOptions {
  request: string;
  /**
   * What the request is for, when the host has already routed it —
   * `routeIntent({ request, document, selection }).kind`, with the page it is
   * about. Gates only skills that declare `activation.intents`. Absent, the
   * resolver routes the words as they would land on a blank page: a brief, a
   * page ask or a site ask keeps page-level expertise, and words that change,
   * add a section to, or ask about what exists drop it.
   */
  intent?: IntentKind;
  selectedSkillIds?: readonly string[];
  selectedBlockTypes?: readonly string[];
  /**
   * Skills that woke earlier in this conversation (2026-10-13): each counts as an auto match
   * while its intent gate allows, so a follow-up keeps the skill set its cached prompt holds.
   */
  carriedSkillIds?: readonly string[];
  auto?: boolean;
  allowUntrusted?: boolean;
  maxActiveSkills?: number;
  maxSkillTokens?: number;
}

export interface AiPreparedSkillContext {
  catalog: readonly AiSkillManifestV1[];
  active: readonly AiActiveSkillContext[];
  activations: readonly AiSkillActivationPin[];
  omitted: readonly AiSkillOmission[];
  totalTokens: number;
  effectiveCommandRestriction?: readonly string[];
}

export interface AiSkillRegistry {
  list(): readonly AiSkillManifestV1[];
  get(id: string): AiSkillManifestV1 | undefined;
  readSkill(id: string): string;
  listReferences(id: string): readonly string[];
  readReference(id: string, path: string): string;
  prepare(options: AiSkillPrepareOptions): AiPreparedSkillContext;
}
