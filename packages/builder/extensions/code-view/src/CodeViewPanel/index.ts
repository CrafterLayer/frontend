import type { ComponentType } from 'react';

import { CodeViewPanel } from './CodeViewPanel';

/**
 * The schema erases contributed panel props to `Record<string, unknown>`.
 * Keep the named export precise for hosts while erasing only the manifest's
 * default boundary; the coordinator supplies the required ports.
 */
const ContributedCodeViewPanel = CodeViewPanel as unknown as ComponentType<Record<string, unknown>>;

export default ContributedCodeViewPanel;
export {
  CodeViewPanel,
  type CodeViewKernel,
  type CodeViewKernelSnapshot,
  type CodeViewPanelProps,
  type CodeViewStatus,
} from './CodeViewPanel';
