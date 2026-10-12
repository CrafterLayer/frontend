import * as Popover from '@radix-ui/react-popover';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { knowledgeLabels, type KnowledgeTab } from '../../copy/knowledge-labels';
import type { AgentKnowledgeView } from '../../model/knowledge';
import type { UserSkillDraft } from '../../model/user-skills';
import { skillTemplates } from '../../model/skill-templates';
import type { Locale } from '../../model/view-types';
import { CheckpointsTab } from '../CheckpointsTab';
import { IconButton, usePortalScope } from '../IconButton';
import { MemoryTab } from '../MemoryTab';
import { SkillsTab } from '../SkillsTab';

import './KnowledgePopover.css';

export interface KnowledgePopoverProps {
  readonly locale: Locale;
  readonly knowledge: AgentKnowledgeView;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The header's Skills & memory button: the popover hangs from it; focus returns to it. */
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** `popover` (default) in the docked panel; `sheet`: the phone sheet's own page. */
  readonly presentation?: 'popover' | 'sheet' | undefined;
  /** The popover's id, for the button's `aria-controls`. Generated when absent. */
  readonly id?: string | undefined;
  /** The tab it opens on (default Skills). */
  readonly initialTab?: KnowledgeTab | undefined;
  /** The tab shown, when the host decides it (the composer's commands); with `onTabChange`. */
  readonly tab?: KnowledgeTab | undefined;
  readonly onTabChange?: ((tab: KnowledgeTab) => void) | undefined;
  /** Open Skills on New skill with this draft (the composer's `/skill`). */
  readonly newSkill?: UserSkillDraft | undefined;
  /** Where "Copy as SKILL.md" writes (tests). */
  readonly clipboard?: ((text: string) => Promise<void>) | undefined;
}

/**
 * "Skills & memory" (2026-10-12): what the Agent knows, in one place under the header's
 * button — the person's own skills, the project memory and the page's checkpoints — as three
 * tabs (arrow keys move between them, as tabs do). A Radix Popover in the docked panel, the
 * phone sheet's own page there. The Checkpoints tab is drawn only when the host keeps pages.
 */
export function KnowledgePopover({
  locale,
  knowledge,
  open,
  onOpenChange,
  anchorRef,
  presentation = 'popover',
  id,
  initialTab = 'skills',
  tab: shownTab,
  onTabChange,
  newSkill,
  clipboard,
}: KnowledgePopoverProps) {
  const generated = useId();
  const rootId = id ?? generated;
  const labels = knowledgeLabels(locale);
  const { scope, capture } = usePortalScope();
  const tabs: readonly KnowledgeTab[] =
    knowledge.checkpoints === undefined
      ? ['skills', 'memory']
      : ['skills', 'memory', 'checkpoints'];
  const [ownChoice, setOwnChoice] = useState<KnowledgeTab>(initialTab);
  const chosen = shownTab ?? ownChoice;
  const setChosen = (next: KnowledgeTab) => {
    setOwnChoice(next);
    onTabChange?.(next);
  };
  const tab = tabs.includes(chosen) ? chosen : 'skills';
  const tabRefs = useRef(new Map<KnowledgeTab, HTMLButtonElement>());
  const interactedOutside = useRef(false);

  // Read the panel's scope off the header button before the popover opens, so it mounts
  // inside the panel, in its theme, language and direction (as HistoryPopover does).
  useEffect(() => {
    const anchor = anchorRef.current;
    if (anchor === null) return undefined;
    const read = (): void => {
      capture(anchor);
    };
    read();
    anchor.addEventListener('pointerdown', read);
    anchor.addEventListener('keydown', read);
    return () => {
      anchor.removeEventListener('pointerdown', read);
      anchor.removeEventListener('keydown', read);
    };
  }, [anchorRef, capture]);

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: locale === 'ar' ? -1 : 1,
      ArrowLeft: locale === 'ar' ? 1 : -1,
    };
    const step = keys[event.key];
    const index = tabs.indexOf(tab);
    let next: KnowledgeTab | undefined;
    if (step !== undefined) next = tabs[(index + step + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    tabRefs.current.get(next)?.focus();
  };

  let panel: ReactNode;
  if (tab === 'memory') panel = <MemoryTab memory={knowledge.memory} labels={labels} />;
  else if (tab === 'checkpoints' && knowledge.checkpoints !== undefined) {
    panel = <CheckpointsTab checkpoints={knowledge.checkpoints} labels={labels} locale={locale} />;
  } else {
    panel = (
      <SkillsTab
        skills={knowledge.skills}
        labels={labels}
        clipboard={clipboard}
        templates={skillTemplates(locale)}
        startWith={newSkill}
      />
    );
  }

  const body = (
    <>
      <div className="ck-agent-knowledge__head">
        <h2 id={`${rootId}-title`} className="ck-agent-knowledge__title">
          {labels.title}
        </h2>
        <IconButton
          icon="close"
          label={labels.close}
          onClick={() => {
            onOpenChange(false);
          }}
        />
      </div>
      <div
        role="tablist"
        aria-label={labels.title}
        className="ck-agent-knowledge__tabs"
        onKeyDown={onTabKey}
      >
        {tabs.map((name) => (
          <button
            key={name}
            ref={(node) => {
              if (node === null) tabRefs.current.delete(name);
              else tabRefs.current.set(name, node);
            }}
            type="button"
            role="tab"
            id={`${rootId}-tab-${name}`}
            aria-selected={tab === name}
            aria-controls={`${rootId}-panel`}
            tabIndex={tab === name ? 0 : -1}
            className="ck-agent-knowledge__tab"
            onClick={() => {
              setChosen(name);
            }}
          >
            {labels.tabs[name]}
          </button>
        ))}
      </div>
      <div
        id={`${rootId}-panel`}
        role="tabpanel"
        aria-labelledby={`${rootId}-tab-${tab}`}
        className="ck-agent-knowledge__panel"
      >
        {panel}
      </div>
    </>
  );

  if (presentation === 'sheet') {
    if (!open) return null;
    return (
      <section
        id={rootId}
        className="ck-agent-knowledge"
        data-presentation="sheet"
        aria-labelledby={`${rootId}-title`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          onOpenChange(false);
        }}
      >
        {body}
      </section>
    );
  }

  const container = scope.container;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal container={container ?? null}>
        <Popover.Content
          id={rootId}
          className="ck-agent-knowledge"
          data-presentation="popover"
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          collisionBoundary={container?.matches('.ck-agent') === true ? container : []}
          sticky="always"
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          aria-labelledby={`${rootId}-title`}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            tabRefs.current.get(tab)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!interactedOutside.current) anchorRef.current?.focus();
            interactedOutside.current = false;
          }}
          onInteractOutside={(event) => {
            const target = event.target as Node | null;
            if (target !== null && anchorRef.current?.contains(target) === true) {
              event.preventDefault();
              return;
            }
            interactedOutside.current = true;
          }}
        >
          {body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
