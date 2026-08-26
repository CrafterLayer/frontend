import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Page } from './Page';

const rootNode = landingFixture().nodes['root'];
if (rootNode === undefined) {
  throw new Error('landing fixture changed: root missing');
}

describe('Page', () => {
  it('renders a main landmark with its slot children in order', () => {
    render(
      <Page
        node={rootNode}
        props={{ title: 'Landing' }}
        slots={{ default: [<p key="a">First</p>, <p key="b">Second</p>] }}
        data={{}}
        isCanvas={false}
      />,
    );
    const main = screen.getByRole('main', { name: 'Landing' });
    expect(main).toHaveTextContent('FirstSecond');
  });

  it('omits the accessible name when the title is empty', () => {
    render(<Page node={rootNode} props={{ title: '' }} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.getByRole('main')).not.toHaveAccessibleName();
  });
});
