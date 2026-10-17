import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder';

import { Announcement } from './Announcement';
import { announcementSchema } from './schema';

const node: Node = { id: 'a', type: 'announcement', props: {} };

describe('Announcement', () => {
  it('renders the message as a status bar', () => {
    render(
      <Announcement
        node={node}
        props={{ message: 'Live!', tone: 'success' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Live!');
  });

  it('schema defaults parse', () => {
    expect(announcementSchema.props.parse({})).toEqual({
      message: 'Registered at runtime — no reload.',
      tone: 'info',
    });
  });
});
