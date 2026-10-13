import type { PlaygroundFixture } from '../../create-playground-kernel';

/** The picker's words; English by default, the host passes its editor's language. */
export interface FixturePickerLabels {
  readonly label: string;
  readonly fixtures: Readonly<Record<PlaygroundFixture, string>>;
}

export const FIXTURE_PICKER_LABELS_EN: FixturePickerLabels = {
  label: 'Fixture',
  fixtures: {
    landing: 'Marketing landing',
    empty: 'Empty page',
    inline: 'Inline editing',
    'code-view': 'Code view',
    'code-page': 'Authored TSX page',
  },
};
