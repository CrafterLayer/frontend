import type { PlaygroundFixture } from '../../create-playground-kernel';

export interface FixturePickerProps {
  value: PlaygroundFixture;
  onChange: (next: PlaygroundFixture) => void;
}

/** Selects which fixture document the playground kernel loads. */
export function FixturePicker({ value, onChange }: FixturePickerProps) {
  return (
    <label>
      Fixture
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value as PlaygroundFixture);
        }}
      >
        <option value="landing">Marketing landing</option>
        <option value="empty">Empty page</option>
        <option value="inline">Inline editing</option>
      </select>
    </label>
  );
}
