import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder';

import { Story } from './Story';
import { storySchema } from './schema';

const node: Node = { id: 's', type: 'story', props: {} };

const prose = storySchema.props.parse({
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bold this line.' }] }],
  },
});

describe('Story', () => {
  it('renders stored rich text through the read path', () => {
    const view = render(<Story node={node} props={prose} slots={{}} data={{}} isCanvas={false} />);
    expect(view.container.textContent).toContain('Bold this line.');
  });

  it('renders the swapped-in element while the canvas edits inline', () => {
    const swapped = { content: <em data-testid="pg-story-swap">editing</em> };
    render(<Story node={node} props={swapped} slots={{}} data={{}} isCanvas />);
    expect(screen.getByTestId('pg-story-swap')).toBeInTheDocument();
  });

  it('declares its rich content inline-editable (B3c: declaration is data)', () => {
    expect(storySchema.inlineEditable).toBe('content');
  });
});
