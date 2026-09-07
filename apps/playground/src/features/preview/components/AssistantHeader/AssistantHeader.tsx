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
  /** The models the host offers (OpenRouter slugs). Fewer than two ⇒ no picker. */
  readonly models?: readonly string[] | undefined;
  readonly model?: string | undefined;
  readonly onSelectModel?: ((model: string) => void) | undefined;
}

/**
 * `vendor/model:free` reads as `model · free`: the vendor is in the slug, not
 * in the way. `cli:haiku` is the person's own Claude subscription through the
 * local CLI, and says so.
 */
function modelLabel(slug: string): string {
  if (slug.startsWith('cli:')) {
    const cliModel = slug.slice('cli:'.length);
    return cliModel === '' ? 'Claude CLI' : `${cliModel} · Claude CLI`;
  }
  const name = slug.slice(slug.lastIndexOf('/') + 1);
  return name.endsWith(':free') ? `${name.slice(0, -':free'.length)} · free` : name;
}

/** Two groups, so WHICH backend answers is visible in the list itself, not only in a label. */
function groupedModels(
  models: readonly string[],
): readonly { label: string; slugs: readonly string[] }[] {
  const cli = models.filter((slug) => slug.startsWith('cli:'));
  const openRouter = models.filter((slug) => !slug.startsWith('cli:'));
  return [
    ...(cli.length === 0 ? [] : [{ label: 'Claude CLI', slugs: cli }]),
    ...(openRouter.length === 0 ? [] : [{ label: 'OpenRouter', slugs: openRouter }]),
  ];
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
  models = [],
  model,
  onSelectModel,
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
          <div className="pg-chat__identity">
            <h2 className="pg-chat__heading">
              <span className="pg-chat__name" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                {AGENT_NAME[locale]}
              </span>
            </h2>
            <AgentVoice className="pg-chat__voice" snapshot={face} locale={locale} />
          </div>
        </div>
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
      <p className="pg-chat__sees">Sees: {sees}</p>
      {/*
        Its own line, below the context: in the title row it competed with the
        identity for width and wrapped the name one letter per line. Same rule
        as the conversation picker: one model is a fact, not a choice.
      */}
      {models.length > 1 ? (
        <p className="pg-chat__model">
          <span aria-hidden="true">Model:</span>
          <select
            className="pg-chat__model-select"
            aria-label="Model"
            title={model ?? models[0]}
            value={model ?? models[0]}
            onChange={(event) => onSelectModel?.(event.currentTarget.value)}
          >
            {groupedModels(models).map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.slugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {modelLabel(slug)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </p>
      ) : null}
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
