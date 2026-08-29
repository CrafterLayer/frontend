import './Page.css';

import type { BlockRenderProps } from '@craftkit/builder-schema';

import type { z } from 'zod';

import type { pageSchema } from './schema';

type PageProps = z.output<typeof pageSchema.props>;

/** The document root: a main landmark flowing its default slot in order. */
export function Page({ props, slots }: BlockRenderProps<PageProps>) {
  return (
    <main
      className="bldr-page"
      aria-label={props.title === '' ? undefined : props.title}
      data-content-width={props.contentWidth}
      lang={props.lang === '' ? undefined : props.lang}
    >
      {slots['default']}
    </main>
  );
}
