import type { PlaygroundFixture } from '../../create-playground-kernel';
import { FIXTURE_PICKER_LABELS_EN, type FixturePickerLabels } from './FixturePicker.labels';

export interface FixturePickerProps {
  value: PlaygroundFixture;
  onChange: (next: PlaygroundFixture) => void;
  showCodePage?: boolean;
  labels?: FixturePickerLabels | undefined;
}

/** Selects which fixture document the playground kernel loads. */
export function FixturePicker({
  value,
  onChange,
  showCodePage = false,
  labels = FIXTURE_PICKER_LABELS_EN,
}: FixturePickerProps) {
  const { fixtures } = labels;
  return (
    <label>
      {labels.label}
      <select
        aria-label={labels.label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value as PlaygroundFixture);
        }}
      >
        <option value="landing">{fixtures.landing}</option>
        <option value="empty">{fixtures.empty}</option>
        <option value="inline">{fixtures.inline}</option>
        <option value="code-view">{fixtures['code-view']}</option>
        {showCodePage ? <option value="code-page">{fixtures['code-page']}</option> : null}
      </select>
    </label>
  );
}
