import type { BuilderKernel, BuilderSiteKernel } from '@craftkit/builder';

import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import { DirectionFlip } from '../features/preview/components/DirectionFlip';
import { FixturePicker } from '../features/preview/components/FixturePicker';
import { RegisterDemoExtension } from '../features/preview/components/RegisterDemoExtension';
import { ChromePicker, type ChromeChoice } from '../features/preview/components/ChromePicker';
import { ThemePicker, type ThemeName } from '../features/preview/components/ThemePicker';
import { PROFESSIONAL_BUILDER_FLAGS } from '../features/preview/feature-flags';
import { rememberCurrentWorkspace } from '../features/preview/workspace-preferences';
import { rememberEditorLocale, type EditorLocale } from './editor-labels';

export interface HarnessSettingsPanelProps {
  readonly fixture: PlaygroundFixture;
  readonly onFixtureChange: (fixture: PlaygroundFixture) => void;
  readonly chromeChoice: ChromeChoice;
  readonly onChromeChoiceChange: (choice: ChromeChoice) => void;
  readonly themeName: ThemeName;
  readonly onThemeNameChange: (name: ThemeName) => void;
  /** The visible name of the editor-language select. */
  readonly languageLabel: string;
  readonly editorLocale: EditorLocale;
  readonly onEditorLocaleChange: (locale: EditorLocale) => void;
  readonly kernel: BuilderKernel;
  readonly siteKernel: BuilderSiteKernel;
  /** The code view is open: it has no canvas width to set. */
  readonly codeOpen: boolean;
  readonly canvasWidth: number;
  readonly onCanvasWidthChange: (width: number) => void;
}

/*
  The scenario harness, in a panel of its own. It used to ride in
  the product's action band and then in a sheet floating over the
  canvas — neither is where a developer harness belongs. Here it
  has room, it costs the page nothing when closed, and the action
  band is left to the product.
*/
export function HarnessSettingsPanel({
  fixture,
  onFixtureChange,
  chromeChoice,
  onChromeChoiceChange,
  themeName,
  onThemeNameChange,
  languageLabel,
  editorLocale,
  onEditorLocaleChange,
  kernel,
  siteKernel,
  codeOpen,
  canvasWidth,
  onCanvasWidthChange,
}: HarnessSettingsPanelProps) {
  return (
    <section className="pg-settings" aria-label="Scenario harness">
      <h2>Harness</h2>
      <p>Scenario controls. None of this is part of the product.</p>
      <FixturePicker
        value={fixture}
        onChange={(next) => {
          rememberCurrentWorkspace(next);
          onFixtureChange(next);
        }}
        showCodePage={PROFESSIONAL_BUILDER_FLAGS.v2Authoring || fixture === 'code-page'}
      />
      <ChromePicker value={chromeChoice} onChange={onChromeChoiceChange} />
      <ThemePicker value={themeName} onChange={onThemeNameChange} />
      <label className="pg-width">
        <span>{languageLabel}</span>
        <select
          value={editorLocale}
          onChange={(event) => {
            const next = event.currentTarget.value === 'ar' ? 'ar' : 'en';
            onEditorLocaleChange(next);
            rememberEditorLocale(next, () => localStorage);
          }}
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </label>
      <DirectionFlip kernel={kernel} siteKernel={siteKernel} />
      <RegisterDemoExtension key={fixture} kernel={kernel} />
      {codeOpen ? null : (
        <label className="pg-width">
          <span>Canvas width</span>
          <input
            type="number"
            min={320}
            max={2560}
            step={10}
            value={canvasWidth}
            onChange={(event) => {
              const width = Number(event.currentTarget.value);
              onCanvasWidthChange(width);
            }}
          />
        </label>
      )}
    </section>
  );
}
