import './Announcement.css';

import type { BlockRenderProps } from '@craftkit/builder';

import type { AnnouncementProps } from './schema';

/** The runtime-demo block: a status bar that only exists after live registration. */
export function Announcement({ props }: BlockRenderProps<AnnouncementProps>) {
  return (
    <p role="status" className={`pg-announcement pg-announcement--${props.tone}`}>
      {props.message}
    </p>
  );
}
