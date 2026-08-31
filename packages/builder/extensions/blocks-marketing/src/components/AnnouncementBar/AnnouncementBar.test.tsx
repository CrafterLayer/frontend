import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AnnouncementBar } from './AnnouncementBar';
import { announcementBarSchema } from './schema';

const node: Node = { id: 'announcement', type: 'announcementBar', props: {} };

describe('AnnouncementBar', () => {
  it('renders a labelled complementary region with a safe destination link', () => {
    render(
      <AnnouncementBar
        node={node}
        props={announcementBarSchema.props.parse({
          label: 'Update',
          message: 'The new workspace is ready.',
          linkLabel: 'Read the notes',
          href: '/release-notes',
          layout: 'split',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('complementary', { name: 'The new workspace is ready.' });
    expect(region).toHaveClass('bg-accent', '@container', 'shadow-soft');
    expect(screen.getByText('Update')).toBeVisible();
    expect(screen.getByRole('link', { name: /Read the notes/ })).toHaveClass('rounded-full');
    expect(screen.getByRole('link', { name: /Read the notes/ })).toHaveAttribute(
      'href',
      '/release-notes',
    );
  });

  it('can hide supporting chrome without hiding the message', () => {
    render(
      <AnnouncementBar
        node={node}
        props={announcementBarSchema.props.parse({
          message: 'Quiet maintenance notice.',
          showLabel: false,
          showLink: false,
          emphasis: 'subtle',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByText('Quiet maintenance notice.')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('applies token roles and logical spacing controls on the root', () => {
    render(
      <AnnouncementBar
        node={node}
        props={announcementBarSchema.props.parse({
          message: 'Styled announcement.',
          background: 'surfaceInverse',
          textColor: 'textInverse',
          marginBlockEnd: 4,
          fontWeight: 'bold',
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const region = screen.getByRole('complementary', { name: 'Styled announcement.' });
    expect(region.style.background).toBe('var(--t-surface-inverse)');
    expect(region.style.color).toBe('var(--t-text-inverse)');
    expect(region.style.marginBlockEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
    expect(region).toHaveClass('mkt-type--weight-bold');
  });

  it('ships a complete default and rejects unsafe or malformed links', () => {
    const props = announcementBarSchema.props.parse({});
    expect(props).toMatchObject({
      label: 'New',
      showLabel: true,
      showLink: true,
      emphasis: 'accent',
      layout: 'inline',
      density: 'compact',
      align: 'center',
      spacing: 'none',
      width: 'wide',
    });
    expect(props.message.length).toBeGreaterThan(0);
    expect(announcementBarSchema.props.safeParse({ href: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(announcementBarSchema.props.safeParse({ message: '' }).success).toBe(false);
  });
});
