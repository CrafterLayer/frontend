import { Component, type ReactNode } from 'react';

interface FieldErrorBoundaryProps {
  children: ReactNode;
  /**
   * What shows once a renderer threw. A function receives the error, so the
   * row can show its sentence — a rich-text row shows the editor skeleton with
   * the error and a Retry button, never the raw value.
   */
  fallback: ReactNode | ((error: unknown) => ReactNode);
  /** Fired once on catch — the row swaps the failed renderer for its fallback. */
  onFieldError: (error: unknown) => void;
}

interface FieldErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

/**
 * Containment for field renderers (FR-005): a contributed component that
 * throws is caught HERE, reported up, and never takes the rest of the panel
 * down. The row remounts the boundary (new key) with its fallback.
 */
export class FieldErrorBoundary extends Component<
  FieldErrorBoundaryProps,
  FieldErrorBoundaryState
> {
  override state: FieldErrorBoundaryState = { failed: false, error: undefined };

  static getDerivedStateFromError(error: unknown): FieldErrorBoundaryState {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onFieldError(error);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function' ? fallback(this.state.error) : fallback;
  }
}
