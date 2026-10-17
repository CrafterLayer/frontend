/**
 * The frame every background-jobs story draws in (2026-10-12): a panel root as AgentPanel
 * draws it — the `ck-agent` scope a dialog portals into, the story's theme, language and
 * direction, the `agent` inline-size container — with the panel's tooltip provider.
 * Parameters: `panel.theme` (`light` | `dark`), `panel.width` (px), `panel.height` (px).
 */
import type { Decorator } from '@storybook/react-vite';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../copy';
import { AgentTooltipProvider } from '../components/IconButton';
import type { Locale } from '../model/view-types';

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  readonly height?: number;
}

export const jobsFrame: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 520, height } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className="ck-agent"
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        inlineSize: width,
        maxInlineSize: '100%',
        ...(height === undefined ? {} : { blockSize: height }),
        padding: 'var(--bldr-space-3xl)',
        background: 'var(--bldr-surface)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        fontSize: 'var(--bldr-font-size-read)',
        lineHeight: 'var(--bldr-line-height-read)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <AgentTooltipProvider delayDuration={0}>
        <Story />
      </AgentTooltipProvider>
    </section>
  );
};
