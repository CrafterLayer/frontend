import type { SiteRunSeam } from '../../../preview/components/AssistantPanel/use-site-run';
import {
  useAgentController,
  type UseAgentControllerOptions,
} from '../../hooks/use-agent-controller';

import { AgentPanel, type AgentPanelProps } from './AgentPanel';
import { useSiteSeam } from './use-site-seam';

export interface LiveAgentPanelProps
  extends UseAgentControllerOptions,
    Omit<AgentPanelProps, 'controller'> {
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
  ...options
}: LiveAgentPanelProps) {
  const controller = useAgentController(options);
  useSiteSeam(controller, onSiteSeam);
  return (
    <AgentPanel
      controller={controller}
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
