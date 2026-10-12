import type { BackgroundJobsHost } from '../../../jobs';
import type { SiteRunSeam } from '../../../preview/components/AssistantPanel/use-site-run';
import { batchAgentOptions } from '../../hooks/batch-agent-options';
import { useAgentKnowledge, useReleasePinsAfterRun } from '../../hooks/use-agent-knowledge';
import {
  useAgentController,
  type UseAgentControllerOptions,
} from '../../hooks/use-agent-controller';
import { useBackgroundJobs } from '../../hooks/use-background-jobs';

import { AgentPanel, type AgentPanelProps } from './AgentPanel';
import { useSiteSeam } from './use-site-seam';

export interface LiveAgentPanelProps
  extends UseAgentControllerOptions, Omit<AgentPanelProps, 'controller' | 'jobs'> {
  /** The run lease the Site destination borrows (see `useSiteSeam`). */
  readonly onSiteSeam?: ((seam: SiteRunSeam) => void) | undefined;
  /**
   * Background jobs (2026-10-12): the host's batch client, site and job store. Given, the
   * header draws "Background jobs" and the composer's `/batch` opens its form.
   */
  readonly backgroundJobs?: BackgroundJobsHost | undefined;
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
  backgroundJobs,
  ...options
}: LiveAgentPanelProps) {
  // The person's skills, the project memory and the checkpoints (2026-10-12).
  const knowledge = useAgentKnowledge({ storage: options.storage, checkpoints, locale: options.locale });
  const controller = useAgentController({ ...options, ...knowledge.controllerOptions });
  useReleasePinsAfterRun(controller.state.run !== null, knowledge.view);
  useSiteSeam(controller, onSiteSeam);
  // Each page of a background job is asked and landed with what a live run would take.
  const runOptions = { ...options, ...knowledge.controllerOptions };
  const jobs = useBackgroundJobs({
    host: backgroundJobs,
    locale: options.locale,
    agentOptions: (request) => batchAgentOptions(runOptions, request),
    model: options.model,
    kernel: options.kernel,
    live: controller,
  });
  return (
    <AgentPanel
      controller={controller}
      knowledge={knowledge.view}
      jobs={jobs}
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
