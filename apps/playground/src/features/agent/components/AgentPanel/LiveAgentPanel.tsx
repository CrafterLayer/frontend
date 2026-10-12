import type { SiteRunSeam } from '../../../preview/components/AssistantPanel/use-site-run';
import { useAgentKnowledge, useReleasePinsAfterRun } from '../../hooks/use-agent-knowledge';
import {
  useAgentController,
  type UseAgentControllerOptions,
} from '../../hooks/use-agent-controller';

import { AgentPanel, type AgentPanelProps } from './AgentPanel';
import { useSiteSeam } from './use-site-seam';

export interface LiveAgentPanelProps
  extends UseAgentControllerOptions, Omit<AgentPanelProps, 'controller'> {
  /** The run lease the Site destination borrows (see `useSiteSeam`). */
  readonly onSiteSeam?: ((seam: SiteRunSeam) => void) | undefined;
}

/**
 * The panel the app mounts: `useAgentController` over the host's kernel, provider and
 * capabilities, wired into AgentPanel. Everything the controller takes (`kernel`,
 * `locale`, `provider`, `addPage`, `editModel`, …) and everything the panel takes
 * (`visible`, `width`, `pillContainer`, …) are props of this one component.
 */
export function LiveAgentPanel({
  visible,
  width,
  onWidthChange,
  presentation,
  onClose,
  returnFocus,
  pillContainer,
  onOpen,
  tooltipDelay,
  className,
  onSiteSeam,
  checkpoints,
  ...options
}: LiveAgentPanelProps) {
  // The person's skills, the project memory and the checkpoints (2026-10-12).
  const knowledge = useAgentKnowledge({ storage: options.storage, checkpoints, locale: options.locale });
  const controller = useAgentController({ ...options, ...knowledge.controllerOptions });
  useReleasePinsAfterRun(controller.state.run !== null, knowledge.view);
  useSiteSeam(controller, onSiteSeam);
  return (
    <AgentPanel
      controller={controller}
      knowledge={knowledge.view}
      visible={visible}
      width={width}
      onWidthChange={onWidthChange}
      presentation={presentation}
      onClose={onClose}
      returnFocus={returnFocus}
      pillContainer={pillContainer}
      onOpen={onOpen}
      tooltipDelay={tooltipDelay}
      className={className}
    />
  );
}
