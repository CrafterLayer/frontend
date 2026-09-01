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
      keywords?: readonly string[];
      selectedBlockTypes?: readonly string[];
      /** Activate when the request is written in any of these scripts. */
      scripts?: readonly AiSkillScript[];
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

export type AiSkillOmissionCode = 'active-limit' | 'conflict' | 'token-budget' | 'untrusted';

export interface AiSkillOmission {
  id: string;
  code: AiSkillOmissionCode;
  message: string;
}

export interface AiSkillPrepareOptions {
  request: string;
  selectedSkillIds?: readonly string[];
  selectedBlockTypes?: readonly string[];
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
