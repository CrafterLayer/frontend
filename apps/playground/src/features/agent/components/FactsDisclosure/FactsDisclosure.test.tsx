/**
 * FactsDisclosure (SPEC §4.8, §3.5): the sample details a build made up, to replace before
 * publishing. A disclosure (`aria-expanded`, `aria-controls`), hidden when there is nothing to
 * replace; open, each sample is a button that selects the section it sits in, named by the
 * catalog's sentence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { FACTS } from '../../testing/wp-12-records-fixtures';

import { FactsDisclosure } from './FactsDisclosure';

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'FactsDisclosure',
    'FactsDisclosure.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('FactsDisclosure', () => {
  it('renders nothing when there is nothing to replace', () => {
    const { container } = render(<FactsDisclosure locale="en" facts={[]} onReveal={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is a closed disclosure that counts the samples', () => {
    render(<FactsDisclosure locale="en" facts={FACTS.en} onReveal={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Sample details to replace (3)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    // Closed, the list is inert: nothing in it can be reached.
    expect(panel).toHaveAttribute('inert');
  });

  it('opens on the toggle, keeps focus on it, and says what the list is', async () => {
    const user = userEvent.setup();
    render(<FactsDisclosure locale="en" facts={FACTS.en} onReveal={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Sample details to replace (3)' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    if (panel === null) throw new Error('no panel');
    expect(panel).not.toHaveAttribute('inert');
    expect(within(panel).getByText(t('en', 'facts.intro'))).toBeInTheDocument();
  });

  it('selects the section a sample sits in, each row named by the catalog’s sentence', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(<FactsDisclosure locale="en" facts={FACTS.en} onReveal={onReveal} />);
    await user.click(screen.getByRole('button', { name: /^Sample details/u }));
    const row = screen.getByRole('button', { name: '“Dr. Lina Haddad” in Doctors' });
    expect(row).toHaveTextContent('“Dr. Lina Haddad”Doctors');
    await user.click(row);
    expect(onReveal).toHaveBeenCalledExactlyOnceWith('sec-5');
  });

  it('quotes in Arabic with «», and names each row in Arabic', async () => {
    const user = userEvent.setup();
    render(<FactsDisclosure locale="ar" facts={FACTS.ar} onReveal={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'معلومات افتراضية للاستبدال (3)' }));
    const row = screen.getByRole('button', { name: '«د. لينا حداد» في «الأطباء»' });
    expect(row).toHaveTextContent('«د. لينا حداد»الأطباء');
  });
});

describe('FactsDisclosure.css', () => {
  it('writes the toggle in Amber, Meta 500, and the rows at the row height', () => {
    expect(CSS).toMatch(/color:\s*var\(--bldr-warning\)/);
    expect(CSS).toMatch(/font-weight:\s*var\(--bldr-font-weight-medium\)/);
    expect(CSS).toMatch(/min-block-size:\s*var\(--bldr-agent-row-height\)/);
  });

  it('opens over enter and closes over exit, only once the person has used it', () => {
    expect(CSS).toMatch(/\[data-animate\]\[data-open\] \.ck-agent-facts__panel \{\s*transition:\s*grid-template-rows var\(--bldr-duration-enter\) var\(--bldr-easing-enter\)/);
    expect(CSS).toMatch(/\[data-animate\] \.ck-agent-facts__panel \{\s*transition:\s*grid-template-rows var\(--bldr-duration-exit\) var\(--bldr-easing-exit\)/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
