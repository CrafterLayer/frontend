import { describe, expect, it } from 'vitest';

import { checkSection } from './check-section';
import { BUILDER_PLAN, writerSteps } from './tidy.fixtures';
import { tidySection } from './tidy-section';
import type { PagePlan, PagePlanDesign, SectionCheckIssue } from './types';

function page(kind: PagePlanDesign['kind'] = 'resume'): PagePlan {
  return {
    ...BUILDER_PLAN,
    design: { kind, composition: 'bespoke', chrome: 'none', concept: 'A content-led page.' },
    primaryCta: { label: 'Calculate', href: '#hero' },
  };
}

function check(content: string, plan = page(), js?: string): readonly SectionCheckIssue[] {
  const hero = plan.sections[0];
  if (hero === undefined) throw new Error('Fixture needs its hero');
  return checkSection(plan, hero, {
    tree: `<section id="hero"><h1>Profile</h1>${content}</section>`,
    ...(js === undefined ? {} : { js }),
  });
}

const placeholders = (issues: readonly SectionCheckIssue[]) =>
  issues.filter(({ code }) => code === 'placeholder-left');
const actions = (issues: readonly SectionCheckIssue[]) =>
  issues.filter(({ code }) => code === 'cta-label');

describe('personal page missing facts', () => {
  it.each(['resume', 'portfolio'] as const)('allows plainly missing fields on a %s', (kind) => {
    expect(
      placeholders(
        check(
          '<p>[your email]</p><p>[بريدك]</p><p>[votre adresse e-mail]</p><p>[氏名]</p><p>Your address</p>',
          page(kind),
        ),
      ),
    ).toEqual([]);
  });

  it('keeps the existing business placeholder check', () => {
    expect(placeholders(check('<p>[your email]</p>', page('website')))).toHaveLength(1);
  });

  it.each(['lorem ipsum', 'THE SECTION TITLE', '{{title}}', 'هذا النص هو مثال', 'XXX'])(
    'rejects %s without asking for invented facts',
    (filler) => {
      const issues = placeholders(check(`<p>[your email] ${filler}</p>`));
      expect(issues).not.toHaveLength(0);
      expect(issues.every(({ message }) => message.includes('never invent'))).toBe(true);
      expect(issues.every(({ message }) => !message.includes('realistic'))).toBe(true);
    },
  );

  it.each(['mailto:hello@example.com', 'mailto:[your email]', 'tel:0000000000'])(
    'rejects a personal fake contact destination: %s',
    (href) => {
      const plan = {
        ...page(),
        primaryCta: { label: 'Contact', href },
        facts: [{ key: 'phone', sample: '0000000000', section: 'hero' }],
      };
      const issues = placeholders(check(`<a href="${href}">Contact</a>`, plan));
      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toContain('attributes.href');
      expect(issues[0]?.message).toContain('never invent');
    },
  );
});

describe('authored button actions', () => {
  const button = '<button type="button" data-scene-action="calculate">Calculate</button>';
  const selector = '[data-scene-action="calculate"]';
  const direct = `ck.root.querySelector('${selector}')?.addEventListener('click', calculate);`;

  it.each([
    direct,
    "ck.root.querySelector('button')?.addEventListener('click', calculate);",
    `const button = ck.root.querySelector('${selector}'); button?.addEventListener('click', calculate);`,
    `const root = ck.root; const button = root.querySelector('${selector}'); if (button) button.addEventListener('click', calculate);`,
    `ck.root.querySelectorAll('${selector}').forEach(button => button.addEventListener('click', calculate));`,
    `ck.root.addEventListener('click', event => { if (event.target.closest('${selector}')) calculate(); });`,
  ])('admits an explicit selector click binding without asserting runtime verification', (js) => {
    expect(actions(check(button, page('website'), js))).toEqual([]);
  });

  it.each([
    '',
    'const answer = 42;',
    `ck.root.querySelector('[data-scene-action="other"]')?.addEventListener('click', calculate);`,
    `ck.root.querySelector('${selector}')?.addEventListener('mouseover', calculate);`,
    `// ${direct}`,
    `const example = ${JSON.stringify(direct)};`,
  ])('keeps an unbound action button flagged despite unrelated text/code', (js) => {
    expect(actions(check(button, page('website'), js))).toHaveLength(1);
  });

  it('requires a matching native popover target', () => {
    const trigger = '<button popovertarget="details">Calculate</button>';
    expect(actions(check(`${trigger}<div id="details" popover="auto">Details</div>`))).toEqual([]);
    expect(actions(check(trigger))).toHaveLength(1);
    expect(actions(check(`${trigger}<div id="details">Not a popover</div>`))).toHaveLength(1);
  });

  it.each(['copy-text', 'back-to-top'])(
    'admits the supported %s button interaction',
    (behavior) => {
      expect(
        actions(
          check(
            `<button data-ck-behavior="${behavior}" data-ck-text="Supplied text">Calculate</button>`,
          ),
        ),
      ).toEqual([]);
    },
  );

  it('does not treat a passive visual behavior as a click action', () => {
    expect(actions(check('<button data-ck-behavior="reveal">Calculate</button>'))).toHaveLength(1);
  });

  it('still rejects mislabeled navigation and nonexistent anchors beside valid script', () => {
    const issues = check(`${button}<a href="#missing">Calculate</a>`, page('website'), direct);
    expect(actions(issues)).toHaveLength(1);
    expect(actions(issues)[0]?.message).toContain('leads to #missing');
    expect(issues.some(({ code }) => code === 'missing-anchor')).toBe(true);
  });

  it('does not let an href turn a plain button into a link', () => {
    expect(actions(check('<button href="#hero">Calculate</button>'))).toHaveLength(1);
  });

  it('does not assume querySelector binds every matching button', () => {
    expect(actions(check(`${button}${button}`, page('website'), direct))).toHaveLength(1);
  });

  it('leaves an ambiguous authored button for the writer instead of turning it into navigation', () => {
    const plan = page('website');
    const commands = writerSteps(`<section id="hero"><h1>Calculator</h1>${button}</section>`);
    const report = tidySection(commands, { plan, contract: plan.sections[0] });
    expect(report.fixed).not.toContain('cta-label');
    expect(report.commands).toBe(commands);
  });
});
