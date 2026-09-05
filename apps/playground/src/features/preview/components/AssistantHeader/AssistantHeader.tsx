import { ChromeButton } from '@craftkit/builder';
import type { Ref } from 'react';

import { AgentFace, AgentVoice, type AgentLocale, type AgentMoodSnapshot } from '../AgentFace';
import { IconPlus } from '../AssistantPanel/AssistantPanel.icons';
import { ConversationMenu, type ConversationSummary } from '../ConversationMenu';

/** One name, chosen by locale. Never both: a bilingual header reads as two people. */
const AGENT_NAME = { ar: 'أبو غضب', en: 'Abu Ghadab' } as const satisfies Record<
  AgentLocale,
  string
>;

export interface AssistantHeaderProps {
  readonly locale: AgentLocale;
  /** Everything the face is doing right now, and what the voice narrates. */
  readonly face: AgentMoodSnapshot;
  /** What the assistant can SEE, stated rather than guessed at. */
  readonly sees: string;
  readonly conversations: readonly ConversationSummary[];
  readonly activeId: string;
  readonly onSelectConversation: (id: string) => void;
  readonly onNewChat: () => void;
  /** The zone his eyes follow, and the seat they return to. Both from `useFaceLook`. */
  readonly watchZone: Ref<HTMLElement>;
  readonly holdSeat: Ref<HTMLSpanElement>;
}

/**
 * Who you are talking to, what he can see, and which conversation you are in.
 *
 * The tool is called Assistant — that is the region's accessible name, set by
 * the panel — and the person inside it is أبو غضب. The face here is decoration;
 * the voice beneath it is what a screen reader actually hears.
 */
export function AssistantHeader({
  locale,
  face,
  sees,
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  watchZone,
  holdSeat,
}: AssistantHeaderProps) {
  return (
    <header className="pg-chat__head" ref={watchZone}>
      <div className="pg-chat__title">
        <div className="pg-chat__brand">
          {/* The seat writes the look and the press; the face only reads them. */}
          <span className="pg-chat__brand-mark" aria-hidden="true" ref={holdSeat}>
            <AgentFace
              size="md"
              live
              mood={face.mood}
              variant={face.variant}
              outcome={face.outcome}
              typing={face.typing}
            />
          </span>
          <h2 className="pg-chat__heading">
            <span className="pg-chat__name" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
              {AGENT_NAME[locale]}
            </span>
          </h2>
        </div>
        <ChromeButton variant="quiet" size="sm" onClick={onNewChat}>
          <IconPlus />
          New chat
        </ChromeButton>
      </div>
      <AgentVoice className="pg-chat__voice" snapshot={face} locale={locale} />
      <p className="pg-chat__sees">Sees: {sees}</p>
      {/*
        The picker appears only once a second conversation exists. A menu with
        one option is a label wearing a chevron.
      */}
      {conversations.length > 1 ? (
        <ConversationMenu
          conversations={conversations}
          activeId={activeId}
          onSelect={onSelectConversation}
        />
      ) : null}
    </header>
  );
}
