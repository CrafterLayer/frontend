import { useRef, useState } from 'react';

import type {
  AgentController,
  Locale,
  PlanOp,
  RecordMenuItem,
  TurnView as TurnViewData,
} from '../../model/view-types';
import { AnswerRecord } from '../AnswerRecord';
import { BuildRecord } from '../BuildRecord';
import { EditRecord } from '../EditRecord';
import { EndNote } from '../EndNote';
import { ErrorRecord } from '../ErrorRecord';
import { PagePlanCard } from '../PagePlanCard';
import { ProposalCard } from '../ProposalCard';
import { RestoreDialog } from '../RestoreDialog';
import { StepPlanCard } from '../StepPlanCard';
import { UserMessage } from '../UserMessage';

import { runMenuItem } from './run-menu-item';

/**
 * Every action a turn can reach: the controller without its state. AgentController
 * satisfies it as it is, and so does the fake one in stories and tests.
 */
export type TurnActions = Omit<AgentController, 'state' | 'capabilities'>;

export interface TurnViewProps {
  readonly locale: Locale;
  /** One turn of the thread (`AgentViewState.turns[i]`). */
  readonly turn: TurnViewData;
  readonly actions: TurnActions;
  /**
   * The composer's textarea: where focus lands after "Reuse request" puts the words back
   * in it (SPEC §6.3). Asked for at the moment the menu closes, not at render.
   */
  readonly composer?: (() => HTMLElement | null | undefined) | undefined;
  /**
   * Whether the page plan would take an op, for PagePlanCard (`accepts`). The controller
   * does not expose the plan's engine draft yet, so the panel leaves it out and the card
   * offers what it can see (moves, removals down to two, additions up to twelve).
   */
  readonly acceptsPlanOp?: ((turnId: string, op: PlanOp) => boolean) | undefined;
  /** SPEC §7.6 E0c: an Ask plan whose empty layout was written before approval. */
  readonly layoutPrepared?: ((turnId: string) => boolean) | undefined;
}

/**
 * A turn, drawn as its record or card (SPEC §7.2 #50): the one place that knows which
 * component draws which of the nine v2 turn kinds, and the one place that runs a record's
 * `[⋯]` menu. AgentThread owns the `<li>` around it, keyed by the turn id, so a turn that
 * changes kind (a plan becoming its build, a proposal its edit) keeps its node.
 *
 * The menu runs here and never posts text as the person's turn: Reuse puts the request
 * back in the composer (and focus with it), Copy writes to the clipboard, Restore opens
 * RestoreDialog over the record, Technical details and View as code go to the host.
 */
export function TurnView({
  locale,
  turn,
  actions,
  composer,
  acceptsPlanOp,
  layoutPrepared,
}: TurnViewProps) {
  const turnId = turn.view.turnId;
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const [restoring, setRestoring] = useState(false);

  const onMenuSelect = (item: RecordMenuItem): void => {
    runMenuItem(item, turnId, actions, () => {
      setRestoring(true);
    });
  };
  const menuFocusAfter = (item: RecordMenuItem): HTMLElement | null | undefined =>
    item === 'reuse' ? composer?.() : undefined;

  const offersRestore = 'menu' in turn.view && turn.view.menu.includes('restore');
  const restoreDialog = offersRestore ? (
    <RestoreDialog
      locale={locale}
      open={restoring}
      onOpenChange={setRestoring}
      onRestore={() => actions.restore(turnId)}
      returnFocusRef={menuTrigger}
    />
  ) : null;

  switch (turn.kind) {
    case 'user':
      return <UserMessage locale={locale} view={turn.view} />;
    case 'build':
      return (
        <>
          <BuildRecord
            locale={locale}
            view={turn.view}
            actions={actions}
            onMenuSelect={onMenuSelect}
            menuFocusAfter={menuFocusAfter}
            menuTriggerRef={menuTrigger}
          />
          {restoreDialog}
        </>
      );
    case 'edit':
      return (
        <>
          <EditRecord
            locale={locale}
            view={turn.view}
            actions={actions}
            onMenuSelect={onMenuSelect}
            menuFocusAfter={menuFocusAfter}
            menuTriggerRef={menuTrigger}
          />
          {restoreDialog}
        </>
      );
    case 'answer':
      return (
        <AnswerRecord
          locale={locale}
          view={turn.view}
          onMenuSelect={onMenuSelect}
          menuFocusAfter={menuFocusAfter}
          menuTriggerRef={menuTrigger}
        />
      );
    case 'page-plan':
      return (
        <PagePlanCard
          locale={locale}
          view={turn.view}
          actions={actions}
          accepts={acceptsPlanOp === undefined ? undefined : (op) => acceptsPlanOp(turnId, op)}
          layoutPrepared={layoutPrepared?.(turnId) ?? false}
        />
      );
    case 'step-plan':
      return <StepPlanCard locale={locale} view={turn.view} actions={actions} />;
    case 'proposal':
      return (
        <ProposalCard
          locale={locale}
          view={turn.view}
          actions={actions}
          onMenuSelect={onMenuSelect}
          menuTriggerRef={menuTrigger}
        />
      );
    case 'error':
      return (
        <>
          <ErrorRecord
            locale={locale}
            view={turn.view}
            actions={actions}
            onMenuSelect={onMenuSelect}
            menuFocusAfter={menuFocusAfter}
            menuTriggerRef={menuTrigger}
          />
          {restoreDialog}
        </>
      );
    case 'end':
      return <EndNote locale={locale} view={turn.view} />;
  }
}
