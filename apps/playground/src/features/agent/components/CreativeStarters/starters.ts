/** The three creative starters, in the order the empty state shows them. */
export const CREATIVE_STARTERS = ['game', 'story', 'bedtime'] as const;
export type CreativeStarter = (typeof CREATIVE_STARTERS)[number];
