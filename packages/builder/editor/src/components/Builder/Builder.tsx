import type { BuilderKernel } from '@craftkit/builder-core';
import { BuilderProvider } from '@craftkit/builder-react';
import {
  CanvasFrame,
  DocumentView,
  lightTheme,
  useKernelSelector,
  type RenderBreakpoint,
  type Theme,
} from '@craftkit/builder-renderer';
import type { NodeId } from '@craftkit/builder-schema';

export interface BuilderProps {
  /** One kernel per builder surface; create it with `createBuilder`/`openDocument`. */
  kernel: BuilderKernel;
  /** Token assignment for the preview frame; defaults to the light starter theme. */
  theme?: Theme;
  breakpoint?: RenderBreakpoint;
  /** Test/dev instrumentation passthrough (SC-002 counting). */
  onBlockRender?: (nodeId: NodeId) => void;
}

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;
const selectDir = (state: KernelState) => state.doc.dir;

/**
 * THE application entrypoint (FR-001): provider + isolation frame + live document
 * view, wired so the frame's direction follows the DOCUMENT live (a `setDocMeta`
 * flip is visible immediately and undoable like any command).
 */
export function Builder({
  kernel,
  theme = lightTheme,
  breakpoint = 'desktop',
  onBlockRender,
}: BuilderProps) {
  const dir = useKernelSelector(kernel, selectDir);
  return (
    <BuilderProvider kernel={kernel}>
      <CanvasFrame theme={theme} dir={dir}>
        <DocumentView kernel={kernel} breakpoint={breakpoint} onBlockRender={onBlockRender} />
      </CanvasFrame>
    </BuilderProvider>
  );
}
