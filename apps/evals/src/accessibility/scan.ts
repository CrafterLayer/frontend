import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import { accessibilityReport, type AccessibilityReport } from './report';

/** Scan an already-open controlled browser page; never navigates or broadens preview permissions. */
export async function scanAccessibility(page: Page): Promise<AccessibilityReport> {
  try {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const report = accessibilityReport(result);
    const text = await page.locator('body').innerText();
    const nonText = await page
      .locator('body img, body svg, body video, body canvas, body input, body iframe')
      .count();
    // An empty document can pass axe rules without presenting any product UI.
    return report.status === 'passed' && text.trim() === '' && nonText === 0
      ? { ...report, status: 'needs-review' }
      : report;
  } catch {
    // Execution failure is not a pass and raw browser/URL errors stay out of model evidence.
    return {
      status: 'execution-failed',
      engine: 'axe-core',
      counts: { violations: 0, blocking: 0, incomplete: 0, passes: 0 },
      violations: [],
      incomplete: [],
      truncated: false,
    };
  }
}
