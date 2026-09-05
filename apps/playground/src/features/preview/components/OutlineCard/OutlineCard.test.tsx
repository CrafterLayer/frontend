import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OutlineCard } from './OutlineCard';

const PLAN = `GOAL: صفحة عيادة أسنان.
OUTLINE: قسم افتتاحي، الخدمات، الفريق، تواصل.
ALTERNATIVES: صفحة واحدة طويلة — لم تُختَر لأن الخدمات تحتاج مساحة.
RISK: لا صور للعيادة.`;

describe('OutlineCard', () => {
  it('offers nothing to apply — there is no proposal in it to act on', () => {
    render(<OutlineCard text={PLAN} dropped={0} />);

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the four labelled parts as lines, because that is the answer’s only structure', () => {
    const { container } = render(<OutlineCard text={PLAN} dropped={0} />);

    const paragraph = container.querySelector('.pg-chat__outline');
    expect(paragraph?.textContent).toContain('GOAL:');
    expect(paragraph?.textContent).toContain('RISK:');
    // The newlines survive: re-flowing them would destroy the structure.
    expect(paragraph?.textContent).toContain('\n');
  });

  it('reads the language from the ANSWER, not from the panel', () => {
    /*
      The model replies in the requester's language, which is not always the
      panel's. Announcing Arabic in an English voice is what `lang` prevents.
    */
    const { rerender, container } = render(<OutlineCard text={PLAN} dropped={0} />);
    expect(container.querySelector('.pg-chat__outline')).toHaveAttribute('lang', 'ar');

    rerender(<OutlineCard text="GOAL: a clinic page." dropped={0} />);
    expect(container.querySelector('.pg-chat__outline')).toHaveAttribute('lang', 'en');
  });

  it('says nothing about dropped commands when there were none', () => {
    const { container } = render(<OutlineCard text={PLAN} dropped={0} />);
    expect(container.querySelector('.pg-chat__outline-note')).toBeNull();
  });

  it('reports commands the model proposed anyway, and counts them', () => {
    const { container } = render(<OutlineCard text={PLAN} dropped={3} />);

    const note = container.querySelector('.pg-chat__outline-note');
    expect(note?.textContent).toContain('3 proposed changes were not kept');
    expect(note?.textContent).toContain('Switch to Ask or Auto to build');
  });

  it('uses the singular for one, because "1 changes were" is a bug a reader sees', () => {
    const { container } = render(<OutlineCard text={PLAN} dropped={1} />);

    const note = container.querySelector('.pg-chat__outline-note')?.textContent ?? '';
    expect(note).toContain('1 proposed change was not kept');
    expect(note).not.toContain('changes were');
  });
});

describe('OutlineCard from a planned build', () => {
  const sections = ['Hero', 'Pricing', 'FAQ'];

  it('lists the page the skeleton would lay out, in its own order', () => {
    render(<OutlineCard text="A landing page." dropped={0} sections={sections} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(sections);
  });

  it('numbers them, because the order IS the plan', () => {
    const { container } = render(
      <OutlineCard text="A landing page." dropped={0} sections={sections} />,
    );
    expect(container.querySelector('ol.pg-chat__outline-sections')).toBeInTheDocument();
  });

  it('lets each title declare its own direction', () => {
    render(<OutlineCard text="صفحة هبوط." dropped={0} sections={['قسم البطل']} />);
    expect(screen.getByText('قسم البطل')).toHaveAttribute('dir', 'auto');
  });

  it('shows no list at all for an ordinary outline', () => {
    const { container } = render(<OutlineCard text="A plan." dropped={0} />);
    expect(container.querySelector('.pg-chat__outline-sections')).toBeNull();
  });

  it('shows no list when the skeleton named no section', () => {
    const { container } = render(<OutlineCard text="A plan." dropped={0} sections={[]} />);
    expect(container.querySelector('.pg-chat__outline-sections')).toBeNull();
  });

  it('offers to build it, and hands the decision up', async () => {
    const onBuild = vi.fn();
    render(
      <OutlineCard text="A landing page." dropped={0} sections={sections} onBuild={onBuild} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Build this' }));
    expect(onBuild).toHaveBeenCalledOnce();
  });

  it('offers nothing to press when the host gave it nowhere to go', () => {
    render(<OutlineCard text="A landing page." dropped={0} sections={sections} />);
    expect(screen.queryByRole('button', { name: 'Build this' })).toBeNull();
  });

  it('closes the action while another run owns the panel', () => {
    render(
      <OutlineCard
        text="A landing page."
        dropped={0}
        sections={sections}
        onBuild={() => undefined}
        busy
      />,
    );
    expect(screen.getByRole('button', { name: 'Build this' })).toBeDisabled();
  });
});
