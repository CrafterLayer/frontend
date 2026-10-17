import type { ProductGridProps } from './schema';

/**
 * The column count that leaves no orphan cell under a full-row featured card
 * (blocks-polish 2026-10-08). The featured card used to share its row, so the
 * row took the height of its neighbour — a blank area under the featured price —
 * and the cards after it left one empty cell. Now it owns its row, and the
 * rest use the count nearest the chosen one that divides them evenly.
 */
export function balancedColumns(
  columns: ProductGridProps['columns'],
  others: number,
): ProductGridProps['columns'] {
  const chosen = Number(columns);
  const candidates = [chosen, chosen - 1, chosen + 1, 2, 3, 4].filter(
    (count) => count >= 2 && count <= 4,
  );
  const even = candidates.find((count) => others > 0 && others % count === 0);
  const count = even ?? (others > 0 && others < chosen ? Math.max(2, others) : chosen);
  return String(count) as ProductGridProps['columns'];
}
