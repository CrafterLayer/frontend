import { useMemo } from 'react';

import type { FieldProps } from '@craftkit/builder-schema';

import { ScriptParamsForm } from '../ScriptParamsForm';
import {
  mergeSceneParams,
  SCENE_SOUND_OPTIONS,
  sceneParamsModel,
  storedSceneParams,
} from './scene-params';
import { useLibraryImages } from './use-library-images';

/**
 * The Inspector's "Scene settings": the controls for a composed region's
 * script params (`jsParams`, pixi-studio DESIGN.md D8), so a person tunes a
 * Pixi scene without touching its code.
 *
 * Chosen by DECLARATION — the `customCodeJsParams()` marker — and handed its
 * sibling props by the Inspector (`siblings: true`), where it finds the spec
 * the Studio wrote (`jsMeta.params`) by the `customCodeJsMeta()` marker. With
 * no spec, every stored key gets a plain control by its value's type.
 *
 * Labels come from the spec in the editor's language, RTL in Arabic. A gesture
 * previews inside the form and commits ONCE (one setProp, one Undo); a value
 * equal to its default is not written, Reset restores the default, and keys
 * outside the spec are kept — the commit merges into the stored record.
 */
export default function CustomCodeParamsField({
  value,
  onChange,
  disabled,
  siblings,
  locale,
  assetLibrary,
}: FieldProps) {
  const model = useMemo(() => sceneParamsModel(value, siblings), [value, siblings]);
  const wantsImages = model.spec.some((entry) => entry.type === 'image');
  const images = useLibraryImages(wantsImages ? assetLibrary : undefined);
  const arabic = locale === 'ar';

  return (
    <ScriptParamsForm
      spec={model.spec}
      // An inferred spec's defaults ARE the stored values: nothing reads as changed.
      values={model.source === 'declared' ? storedSceneParams(value) : undefined}
      locale={arabic ? 'ar' : 'en'}
      dir={arabic ? 'rtl' : 'ltr'}
      disabled={disabled ?? false}
      assets={images}
      soundOptions={SCENE_SOUND_OPTIONS}
      onChange={(next, change) => {
        // Previews stay in the form; the scene re-runs on the commit.
        if (!change.commit) return;
        const merged = mergeSceneParams(value, model, next);
        if (merged !== undefined) onChange(merged);
      }}
    />
  );
}
