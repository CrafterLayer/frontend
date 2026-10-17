import * as Dialog from '@radix-ui/react-dialog';
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
import { AgentIcon, type AgentIconName } from '../AgentIcon';
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
  /** The header's Skills & memory button: focus returns to it when the modal closes. */
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** `modal` (default): centred over the editor; `sheet`: the phone sheet's own page. */
  readonly presentation?: 'modal' | 'sheet' | undefined;
  /** The dialog's id, for the button's `aria-controls`. Generated when absent. */
  readonly id?: string | undefined;
  /** The section it opens on (default Skills). */
  readonly initialTab?: KnowledgeTab | undefined;
  /** The section shown, when the host decides it (the composer's commands); with `onTabChange`. */
  readonly tab?: KnowledgeTab | undefined;
  readonly onTabChange?: ((tab: KnowledgeTab) => void) | undefined;
  /** Open Skills on New skill with this draft (the composer's `/skill`). */
  readonly newSkill?: UserSkillDraft | undefined;
  /** Where "Copy as SKILL.md" writes (tests). */
  readonly clipboard?: ((text: string) => Promise<void>) | undefined;
}

const ICONS: Readonly<Record<KnowledgeTab, AgentIconName>> = {
  skills: 'skills',
  memory: 'book',
  checkpoints: 'history',
};

/** Case- and diacritic-blind, so «الذاكره» finds «الذاكرة» and "MEM" finds Memory. */
function fold(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي');
}

/**
 * "Skills & memory" (2026-10-12): what the Agent knows — the person's own skills and the
 * default ones, the project memory, the page's checkpoints — in one settings window.
 *
 * Redesigned as the editor's settings modal (person's request, 2026-10-12, after Anthropic's
 * settings): centred over the editor with a scrim, a side list of sections with a search box,
 * the section on the other side under its own heading, Close at the inline end. The sections
 * are a vertical tab list (↑ ↓, and ← → mirrored in Arabic, with Home and End); Esc closes and
 * focus returns to the header's button. It mounts inside the panel's scope, so it keeps the
 * panel's theme, language and direction while `position: fixed` centres it on the screen.
 * On a phone it is the sheet's own page, the sections a row of tabs. Checkpoints appear only
 * when the host keeps pages.
 */
export function KnowledgePopover({
  locale,
  knowledge,
  open,
  onOpenChange,
  anchorRef,
  presentation = 'modal',
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
  const [query, setQuery] = useState('');
  const chosen = shownTab ?? ownChoice;
  const setChosen = (next: KnowledgeTab) => {
    setOwnChoice(next);
    onTabChange?.(next);
  };
  const tab = tabs.includes(chosen) ? chosen : 'skills';
  const wanted = fold(query.trim());
  const listed = tabs.filter(
    (name) =>
      wanted === '' || fold(`${labels.tabs[name]} ${labels.searchWords[name]}`).includes(wanted),
  );
  const tabRefs = useRef(new Map<KnowledgeTab, HTMLButtonElement>());

  // Read the panel's scope off the header button before the modal opens, so it mounts inside
  // the panel, in its theme, language and direction (as RestoreDialog does).
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
      ArrowDown: 1,
      ArrowUp: -1,
      ArrowRight: locale === 'ar' ? -1 : 1,
      ArrowLeft: locale === 'ar' ? 1 : -1,
    };
    const step = keys[event.key];
    const index = listed.indexOf(tab);
    let next: KnowledgeTab | undefined;
    if (step !== undefined) next = listed[(index + step + listed.length) % listed.length];
    if (event.key === 'Home') next = listed[0];
    if (event.key === 'End') next = listed[listed.length - 1];
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

  const modal = presentation === 'modal';
  const title = (
    <h2 id={`${rootId}-title`} className="ck-agent-knowledge__title">
      {labels.title}
    </h2>
  );
  const body = (
    <>
      <nav className="ck-agent-knowledge__nav" aria-labelledby={`${rootId}-title`}>
        {modal ? <Dialog.Title asChild>{title}</Dialog.Title> : title}
        <label className="ck-agent-knowledge__search">
          <AgentIcon name="search" className="ck-agent-knowledge__search-glyph" />
          <span className="bldr-visually-hidden">{labels.search}</span>
          <input
            type="search"
            value={query}
            placeholder={labels.search}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
          />
        </label>
        <div
          role="tablist"
          aria-label={labels.title}
          aria-orientation={modal ? 'vertical' : 'horizontal'}
          className="ck-agent-knowledge__tabs"
          onKeyDown={onTabKey}
        >
          {listed.map((name) => (
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
              tabIndex={tab === name || !listed.includes(tab) ? 0 : -1}
              className="ck-agent-knowledge__tab"
              onClick={() => {
                setChosen(name);
              }}
            >
              <AgentIcon name={ICONS[name]} className="ck-agent-knowledge__tab-glyph" />
              <span>{labels.tabs[name]}</span>
            </button>
          ))}
        </div>
        {listed.length === 0 ? (
          <p className="ck-agent-knowledge__nomatch" role="status">
            {labels.noMatch}
          </p>
        ) : null}
      </nav>
      <div className="ck-agent-knowledge__main">
        <div className="ck-agent-knowledge__bar">
          <h3 className="ck-agent-knowledge__section">{labels.tabs[tab]}</h3>
          <IconButton
            icon="close"
            label={labels.close}
            onClick={() => {
              onOpenChange(false);
            }}
          />
        </div>
        <div
          id={`${rootId}-panel`}
          role="tabpanel"
          aria-labelledby={`${rootId}-tab-${tab}`}
          className="ck-agent-knowledge__panel"
        >
          {panel}
        </div>
      </div>
    </>
  );

  if (!modal) {
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={scope.container ?? null}>
        <Dialog.Overlay className="ck-agent-knowledge__scrim" />
        <Dialog.Content
          id={rootId}
          className="ck-agent-knowledge"
          data-presentation="modal"
          lang={scope.lang ?? locale}
          dir={scope.dir ?? (locale === 'ar' ? 'rtl' : 'ltr')}
          aria-labelledby={`${rootId}-title`}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            tabRefs.current.get(tab)?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            anchorRef.current?.focus();
          }}
        >
          {body}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
