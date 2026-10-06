import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FieldServicesProvider } from '../field-services';
import { LinkField } from './LinkField';

afterEach(cleanup);

const linkSchema = z.object({ label: z.string().max(60), href: z.string().max(400) });
const ok = () => vi.fn(() => ({ ok: true as const }));

describe('LinkField', () => {
  it('edits the label and the address, each as ONE commit on blur', async () => {
    const user = userEvent.setup();
    const commit = ok();
    render(
      <LinkField
        schema={linkSchema}
        value={{ label: 'See more', href: '/more' }}
        path={['props', 'link']}
        textKey="label"
        hrefKey="href"
        commit={commit}
      />,
    );
    const text = screen.getByRole('textbox', { name: 'Link text' });
    expect(text).toHaveAttribute('dir', 'auto');
    await user.type(text, ' now');
    expect(commit).not.toHaveBeenCalled();
    await user.tab();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenLastCalledWith({ label: 'See more now', href: '/more' });

    const href = screen.getByRole('textbox', { name: 'Link address' });
    expect(href).toHaveAttribute('dir', 'ltr');
    await user.clear(href);
    await user.type(href, 'https://craftkit.dev{Enter}');
    expect(commit).toHaveBeenLastCalledWith({ label: 'See more', href: 'https://craftkit.dev' });
  });

  it('refuses an unsafe address with a sentence and writes nothing', async () => {
    const user = userEvent.setup();
    const commit = ok();
    render(
      <LinkField
        schema={linkSchema}
        value={{ label: 'x', href: '/a' }}
        path={['props', 'link']}
        textKey="label"
        commit={commit}
      />,
    );
    const href = screen.getByRole('textbox', { name: 'Link address' });
    await user.clear(href);
    await user.type(href, 'javascript:alert(1){Enter}');
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('That address is not allowed');
    expect(href).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers the site pages from the field services as a picker', async () => {
    const user = userEvent.setup();
    const commit = ok();
    render(
      <FieldServicesProvider
        value={{
          pages: [
            { path: '/about', title: 'About' },
            { path: '/', title: 'Home' },
          ],
        }}
      >
        <LinkField
          schema={linkSchema}
          value={{ label: 'x', href: '/a' }}
          path={['props', 'link']}
          textKey="label"
          commit={commit}
        />
      </FieldServicesProvider>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Link to a page' }), '/about');
    expect(commit).toHaveBeenCalledWith({ label: 'x', href: '/about' });
  });

  it('href-only mode for a string property declared kind: link', async () => {
    const user = userEvent.setup();
    const commit = ok();
    render(<LinkField schema={z.string()} value="/old" path={['props', 'href']} commit={commit} />);
    expect(screen.queryByRole('textbox', { name: 'Link text' })).toBeNull();
    const href = screen.getByRole('textbox', { name: 'Link address' });
    await user.clear(href);
    await user.type(href, '#pricing');
    await user.tab();
    expect(commit).toHaveBeenCalledWith('#pricing');
  });

  it('renders the object’s other keys through the host rows', () => {
    const schema = z.object({ label: z.string(), href: z.string(), newTab: z.boolean() });
    render(
      <LinkField
        schema={schema}
        value={{ label: 'x', href: '/a', newTab: false }}
        path={['props', 'cta']}
        textKey="label"
        commit={ok()}
        renderRow={(row) => <span key={row.key} data-testid={`row-${row.propKey}`} />}
      />,
    );
    expect(screen.getByTestId('row-newTab')).toBeInTheDocument();
    expect(screen.queryByTestId('row-label')).toBeNull();
  });

  it('labels itself in Arabic under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <LinkField
          schema={linkSchema}
          value={{ label: 'اقرأ التوثيق', href: '/docs' }}
          path={['props', 'link']}
          textKey="label"
          commit={ok()}
        />
      </FieldServicesProvider>,
    );
    expect(screen.getByRole('textbox', { name: 'نص الرابط' })).toHaveValue('اقرأ التوثيق');
    expect(screen.getByRole('textbox', { name: 'عنوان الرابط' })).toHaveValue('/docs');
  });
});
