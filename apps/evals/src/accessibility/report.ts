export interface AccessibilityFinding {
  readonly rule: string;
  readonly impact: string | null;
  readonly help: string;
  readonly helpUrl: string;
  readonly targets: readonly string[];
}

interface RuleResult {
  readonly id: string;
  readonly impact?: string | null;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly { readonly target: readonly (string | readonly string[])[] }[];
}

export interface AccessibilityReport {
  readonly status: 'passed' | 'failed' | 'needs-review' | 'execution-failed';
  readonly engine: string;
  readonly counts: {
    readonly violations: number;
    readonly blocking: number;
    readonly incomplete: number;
    readonly passes: number;
  };
  readonly violations: readonly AccessibilityFinding[];
  readonly incomplete: readonly AccessibilityFinding[];
  readonly truncated: boolean;
}

const MAX_RULES = 40;
const MAX_TARGETS = 8;

function findings(rules: readonly RuleResult[]): AccessibilityFinding[] {
  return rules.slice(0, MAX_RULES).map((rule) => ({
    rule: rule.id.slice(0, 80),
    impact: rule.impact ?? null,
    help: rule.help.slice(0, 240),
    helpUrl: rule.helpUrl.slice(0, 400),
    // No DOM HTML, input values, page URL or complete axe payload enters evaluation evidence.
    targets: rule.nodes
      .slice(0, MAX_TARGETS)
      .map((node) => node.target.flat().join(' > ').slice(0, 240)),
  }));
}

/** Count the full scan BEFORE limiting evidence. A truncated report cannot conceal a blocker. */
export function accessibilityReport(result: {
  readonly testEngine: { readonly version: string };
  readonly violations: readonly RuleResult[];
  readonly incomplete: readonly RuleResult[];
  readonly passes: readonly unknown[];
}): AccessibilityReport {
  const blocking = result.violations.filter(
    (rule) => rule.impact === 'critical' || rule.impact === 'serious',
  ).length;
  return {
    status:
      blocking > 0
        ? 'failed'
        : result.incomplete.length > 0 || result.violations.length > 0 || result.passes.length === 0
          ? 'needs-review'
          : 'passed',
    engine: `axe-core ${result.testEngine.version}`,
    counts: {
      violations: result.violations.length,
      blocking,
      incomplete: result.incomplete.length,
      passes: result.passes.length,
    },
    violations: findings(result.violations),
    incomplete: findings(result.incomplete),
    truncated: [result.violations, result.incomplete].some(
      (rules) =>
        rules.length > MAX_RULES ||
        rules.some(
          (rule) =>
            rule.nodes.length > MAX_TARGETS ||
            rule.id.length > 80 ||
            rule.help.length > 240 ||
            rule.helpUrl.length > 400 ||
            rule.nodes.some((node) => node.target.flat().join(' > ').length > 240),
        ),
    ),
  };
}
