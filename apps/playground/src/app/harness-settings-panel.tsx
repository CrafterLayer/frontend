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
import { harnessSettingsCopy } from './harness-settings.copy';

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

  UX pass (2026-10-13): it is also where a person changes the editor's
  language and theme, so it reads as Settings — three titled groups
  (Editor, Page, Testing), each field's name above its control — and it
  speaks the editor's language. It was an English-only row of mixed
  44px controls under the word "Harness".
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
  const copy = harnessSettingsCopy(editorLocale);
  return (
    <section className="pg-settings" aria-label={copy.region}>
      <header className="pg-settings__head">
        <h2>{copy.title}</h2>
        <p>{copy.intro}</p>
      </header>
      <section className="pg-settings__group" aria-label={copy.editorGroup}>
        <h3>{copy.editorGroup}</h3>
        <label className="pg-settings__field">
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
        <ChromePicker value={chromeChoice} onChange={onChromeChoiceChange} labels={copy.chrome} />
      </section>
      <section className="pg-settings__group" aria-label={copy.pageGroup}>
        <h3>{copy.pageGroup}</h3>
        <ThemePicker value={themeName} onChange={onThemeNameChange} labels={copy.theme} />
        <div className="pg-settings__field">
          <span>{copy.direction}</span>
          <DirectionFlip kernel={kernel} siteKernel={siteKernel} />
        </div>
        {codeOpen ? null : (
          <label className="pg-settings__field">
            <span>{copy.canvasWidth}</span>
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
      <section className="pg-settings__group" aria-label={copy.testingGroup}>
        <h3>{copy.testingGroup}</h3>
        <FixturePicker
          value={fixture}
          onChange={(next) => {
            rememberCurrentWorkspace(next);
            onFixtureChange(next);
          }}
          showCodePage={PROFESSIONAL_BUILDER_FLAGS.v2Authoring || fixture === 'code-page'}
          labels={copy.fixture}
        />
        <RegisterDemoExtension key={fixture} kernel={kernel} />
      </section>
    </section>
  );
}
