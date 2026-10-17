/**
 * The Pixi Studio library types (DESIGN.md §A.1), as `@craftkit/builder-schema` exports them.
 *
 * This file was a verbatim local stand-in while `schema/src/studio/**` did not exist yet; the
 * schema exports have landed, so it now re-exports them and every set-A preset keeps importing
 * from here unchanged.
 */
export {
  STUDIO_LIB_KEYS,
  type Bilingual,
  type ScriptAuthor,
  type ScriptEntry,
  type ScriptKind,
  type ScriptParamSpec,
  type ScriptParamType,
  type ScriptParamValue,
  type ScriptTier,
  type ScriptTrust,
  type ScriptVersion,
  type StudioLibKey,
} from '@craftkit/builder-schema';
