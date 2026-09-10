import { ChromeButton } from '@craftkit/builder';
import type { Ref } from 'react';

import { AgentFace, AgentVoice, type AgentLocale, type AgentMoodSnapshot } from '../AgentFace';
import { IconPlus } from '../AssistantPanel/AssistantPanel.icons';
import { ConversationMenu, type ConversationSummary } from '../ConversationMenu';

import './AgentDockHeader.css';

const CHARACTER_NAME = { ar: 'أبو غضب', en: 'Abu Ghadab' } as const;

export interface AgentDockHeaderProps {
  readonly locale?: AgentLocale | undefined;
  readonly face: AgentMoodSnapshot;
  readonly conversations: readonly ConversationSummary[];
  readonly activeId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly onNewChat: () => void;
  readonly watchZone?: Ref<HTMLElement> | undefined;
  readonly holdSeat?: Ref<HTMLSpanElement> | undefined;
}

/** Compact persistent header. Scope and model controls belong below, near their decisions. */
export function AgentDockHeader({
  locale = 'en',
  face,
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  watchZone,
  holdSeat,
}: AgentDockHeaderProps) {
  return (
    <header className="pg-agent-dock-header" ref={watchZone}>
      <span className="pg-agent-dock-header__face pg-chat__brand-mark" aria-hidden="true" ref={holdSeat}>
        <AgentFace
          size="sm"
          live
          mood={face.mood}
          variant={face.variant}
          outcome={face.outcome}
          typing={face.typing}
        />
      </span>
      <div className="pg-agent-dock-header__identity">
        <h2>
          Agent
          <span
            className="bldr-visually-hidden"
            aria-hidden="true"
            lang={locale}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            {CHARACTER_NAME[locale]}
          </span>
        </h2>
        <AgentVoice snapshot={face} locale={locale} className="pg-agent-dock-header__voice" />
      </div>
      <div className="pg-agent-dock-header__actions">
        {conversations.length > 1 ? (
          <ConversationMenu
            conversations={conversations}
            activeId={activeId}
            onSelect={onSelectConversation}
          />
        ) : null}
        <ChromeButton
          variant="icon"
          size="sm"
          aria-label="New chat"
          title="New chat"
          onClick={onNewChat}
        >
          <IconPlus />
        </ChromeButton>
      </div>
    </header>
  );
}
