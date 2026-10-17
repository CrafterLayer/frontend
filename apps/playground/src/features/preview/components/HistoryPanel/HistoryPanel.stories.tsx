import type { Meta, StoryObj } from '@storybook/react-vite';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import {
  createMemoryVaultStore,
  createSnapshotShelf,
  type SnapshotShelf,
  type VaultSnapshot,
  type VaultSnapshotMeta,
} from '../../../vault';
import { HistoryPanel } from './HistoryPanel';

/** A fixed moment, so "4 min ago" reads the same in every review of this page. */
const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

/**
 * The shelf contract over an array. The real `createSnapshotShelf` is used by
 * the empty story; a populated one needs entries to already BE there when the
 * panel first reads, and seeding an async store before render is a race a
 * story should not have.
 */
function stubShelf(seed: readonly VaultSnapshot[]): SnapshotShelf {
  const entries: VaultSnapshot[] = [...seed];
  const metaOf = (entry: VaultSnapshot): VaultSnapshotMeta => ({
    id: entry.id,
    label: entry.label,
    ts: entry.ts,
    seq: entry.seq,
    bytes: entry.bytes,
  });
  return {
    save: (entry) => {
      const stored: VaultSnapshot = {
        id: `${String(entry.ts)}-${String(entries.length)}`,
        label: entry.label,
        ts: entry.ts,
        seq: entry.seq,
        bytes: new TextEncoder().encode(JSON.stringify(entry.document)).length,
        document: entry.document,
      };
      entries.unshift(stored);
      return Promise.resolve(metaOf(stored));
    },
    list: () => Promise.resolve(entries.map(metaOf)),
    read: (id) => Promise.resolve(entries.find((entry) => entry.id === id)),
    clear: () => {
      entries.length = 0;
      return Promise.resolve();
    },
  };
}

/** One landing session, shared: three stories do not need three kernels. */
const landing = createPlaygroundKernel();

function keptPage(
  id: string,
  label: string,
  ts: number,
  seq: number,
  bytes: number,
): VaultSnapshot {
  return { id, label, ts, seq, bytes, document: landing.getDocument() };
}

const meta = {
  title: 'Playground/HistoryPanel',
  component: HistoryPanel,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxInlineSize: '320px' }}>
        <Story />
      </div>
    ),
  ],
  args: { now: () => NOW },
} satisfies Meta<typeof HistoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing kept yet — and the panel says what would fill it. */
export const Empty: Story = {
  args: {
    kernel: createPlaygroundKernel({ fixture: 'empty' }),
    shelf: createSnapshotShelf({ store: createMemoryVaultStore(), docId: 'story-empty' }),
  },
};

/** Three restore points, newest first, each with its age and its weight. */
export const WithRestorePoints: Story = {
  args: {
    kernel: landing,
    shelf: stubShelf([
      keptPage('c', 'Before the pricing rewrite', NOW - 2 * MINUTE, 41, 18_640),
      keptPage('b', 'Arabic pass', NOW - 47 * MINUTE, 27, 17_980),
      keptPage('a', 'First draft', NOW - 30 * 60 * MINUTE, 4, 9_120),
    ]),
  },
};
