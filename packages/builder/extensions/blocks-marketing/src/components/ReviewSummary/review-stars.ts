import { formatNumber, type NumberLanguage } from '../section-numbers';

/** How much of each of the five stars a rating fills, 0–1 in tenths: 4.7 → [1, 1, 1, 1, 0.7]. */
export function starFills(rating: number): readonly number[] {
  return Array.from(
    { length: 5 },
    (_, star) => Math.round(Math.min(1, Math.max(0, rating - star)) * 10) / 10,
  );
}

/** The average as printed: one decimal ("4.7", "٤٫٧"). */
export function formatAverage(average: number, language: NumberLanguage): string {
  return formatNumber(average, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** A row of stars' accessible name: the template with `{rating}` replaced ("4.7 out of 5 stars"). */
export function ratingName(template: string, rating: string): string {
  return template.includes('{rating}') ? template.replaceAll('{rating}', rating) : template;
}
