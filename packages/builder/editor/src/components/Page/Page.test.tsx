import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Page } from './Page';
import { pageSchema } from './schema';

const rootNode = landingFixture().nodes['root'];
if (rootNode === undefined) {
  throw new Error('landing fixture changed: root missing');
}

const defaultPageProps = pageSchema.props.parse({});

describe('Page', () => {
  it('defaults every new page setting while leaving sharing overrides optional', () => {
    const props = pageSchema.props.parse({ title: 'Landing' });

    expect(props).toEqual({
      title: 'Landing',
      description: '',
      slug: '',
      contentWidth: 'standard',
      noIndex: false,
      lang: '',
    });
    expect(props).not.toHaveProperty('socialTitle');
    expect(props).not.toHaveProperty('socialDescription');
    expect(props).not.toHaveProperty('socialImage');
  });

  it('assigns every property to an explicit inspector tab and section', () => {
    expect(Object.keys(pageSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(pageSchema.props.shape).sort(),
    );
    expect(pageSchema.propertyGroups).toEqual({
      title: { tab: 'content', section: 'Identity' },
      description: { tab: 'content', section: 'Identity' },
      slug: { tab: 'content', section: 'Identity' },
      socialTitle: { tab: 'content', section: 'Sharing' },
      socialDescription: { tab: 'content', section: 'Sharing' },
      socialImage: { tab: 'content', section: 'Sharing' },
      contentWidth: { tab: 'design', section: 'Appearance' },
      noIndex: { tab: 'advanced', section: 'Indexing' },
      lang: { tab: 'advanced', section: 'Indexing' },
    });
  });

  it('renders a main landmark with its slot children in order', () => {
    render(
      <Page
        node={rootNode}
        props={{ ...defaultPageProps, title: 'Landing' }}
        slots={{ default: [<p key="a">First</p>, <p key="b">Second</p>] }}
        data={{}}
        isCanvas={false}
      />,
    );
    const main = screen.getByRole('main', { name: 'Landing' });
    expect(main).toHaveTextContent('FirstSecond');
  });

  it('omits the accessible name when the title is empty', () => {
    render(<Page node={rootNode} props={defaultPageProps} slots={{}} data={{}} isCanvas={false} />);
    expect(screen.getByRole('main')).not.toHaveAccessibleName();
  });

  it('applies lang to the rendered root when it is non-empty', () => {
    render(
      <Page
        node={rootNode}
        props={{ ...defaultPageProps, lang: 'ar' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('main')).toHaveAttribute('lang', 'ar');
  });

  it('omits the lang attribute when lang is empty', () => {
    render(<Page node={rootNode} props={defaultPageProps} slots={{}} data={{}} isCanvas={false} />);

    expect(screen.getByRole('main')).not.toHaveAttribute('lang');
  });

  it('exposes content width on the rendered root', () => {
    render(
      <Page
        node={rootNode}
        props={{ ...defaultPageProps, contentWidth: 'wide' }}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('main')).toHaveAttribute('data-content-width', 'wide');
  });

  it('keeps metadata settings out of visible page content', () => {
    render(
      <Page
        node={rootNode}
        props={{
          ...defaultPageProps,
          title: 'Accessible page name',
          description: 'Private page summary',
          slug: 'private-path-segment',
          socialTitle: 'Private social title',
          socialDescription: 'Private social summary',
          socialImage: 'https://example.com/private-social-image.png',
          noIndex: true,
        }}
        slots={{ default: <p>Visible page body</p> }}
        data={{}}
        isCanvas={true}
      />,
    );

    const main = screen.getByRole('main', { name: 'Accessible page name' });
    expect(main).toHaveTextContent('Visible page body');
    expect(main).not.toHaveTextContent('Private page summary');
    expect(main).not.toHaveTextContent('private-path-segment');
    expect(main).not.toHaveTextContent('Private social title');
    expect(main).not.toHaveTextContent('Private social summary');
    expect(main).not.toHaveTextContent('https://example.com/private-social-image.png');
    expect(main).not.toHaveTextContent('true');
  });
});
