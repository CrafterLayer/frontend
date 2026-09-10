import type { PlaygroundFixture } from '../../create-playground-kernel';

export interface FixturePickerProps {
  value: PlaygroundFixture;
  onChange: (next: PlaygroundFixture) => void;
  showCodePage?: boolean;
}

/** Selects which fixture document the playground kernel loads. */
export function FixturePicker({ value, onChange, showCodePage = false }: FixturePickerProps) {
  return (
    <label>
      Fixture
      <select
        aria-label="Fixture"
        value={value}
        onChange={(event) => {
          onChange(event.target.value as PlaygroundFixture);
        }}
      >
        <option value="landing">Marketing landing</option>
        <option value="empty">Empty page</option>
        <option value="inline">Inline editing</option>
        <option value="code-view">Code view</option>
        {showCodePage ? <option value="code-page">Authored TSX page</option> : null}
      </select>
    </label>
  );
}
