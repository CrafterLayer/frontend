import { nanoid } from 'nanoid';

import type { IdPort } from '@craftkit/builder-schema';

/** The ONLY file in the kernel allowed to use ambient entropy (Law D). */
export const systemIds: IdPort = {
  newId: () => nanoid(),
};
