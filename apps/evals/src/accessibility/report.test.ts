import { describe, expect, it } from 'vitest';
import { accessibilityReport } from './report';

const issue = (impact: string | null = 'serious') => ({
  id: 'button-name',
  impact,
  help: 'Label the button',
  helpUrl: 'https://dequeuniversity.com/rules/axe/button-name',
  nodes: [{ target: ['#submit'] }],
});
const result = () => ({
  testEngine: { version: '4.13.0' },
  violations: [] as ReturnType<typeof issue>[],
  incomplete: [] as ReturnType<typeof issue>[],
  passes: [{}],
});

describe('accessibility evidence policy', () => {
  it('fails serious/critical findings and never loses blockers beyond the evidence cap', () => {
    const scan = result();
    scan.violations = [...Array.from({ length: 41 }, () => issue('minor')), issue('critical')];
    expect(accessibilityReport(scan)).toMatchObject({
      status: 'failed',
      counts: { violations: 42, blocking: 1 },
      truncated: true,
    });
    expect(accessibilityReport(scan).violations).toHaveLength(40);
  });
  it('distinguishes clean, incomplete, unknown-severity and empty scans', () => {
    expect(accessibilityReport(result()).status).toBe('passed');
    expect(accessibilityReport({ ...result(), incomplete: [issue()] }).status).toBe('needs-review');
    expect(accessibilityReport({ ...result(), violations: [issue(null)] }).status).toBe(
      'needs-review',
    );
    expect(accessibilityReport({ ...result(), passes: [] }).status).toBe('needs-review');
  });
  it('bounds node evidence and omits raw HTML, page URLs and values', () => {
    const scan = {
      ...result(),
      violations: [
        {
          ...issue(),
          html: '<input value="private">',
          nodes: Array.from({ length: 15 }, () => ({ target: ['x'.repeat(1000)] })),
        },
      ],
    };
    const report = accessibilityReport(scan);
    expect(report.violations[0]?.targets).toHaveLength(8);
    expect(report.violations[0]?.targets[0]).toHaveLength(240);
    expect(JSON.stringify(report)).not.toContain('private');
    expect(report.truncated).toBe(true);
    expect(
      accessibilityReport({
        ...result(),
        violations: [{ ...issue(), nodes: [{ target: ['x'.repeat(1000)] }] }],
      }).truncated,
    ).toBe(true);
  });
});
