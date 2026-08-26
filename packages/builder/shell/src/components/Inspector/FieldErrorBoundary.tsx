import { Component, type ReactNode } from 'react';

interface FieldErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  /** Fired once on catch — the row swaps the failed renderer for the default. */
  onFieldError: () => void;
}

interface FieldErrorBoundaryState {
  failed: boolean;
}

/**
 * Containment for field renderers (FR-005): a contributed component that
 * throws is caught HERE, reported up, and never takes the rest of the panel
 * down. The row remounts the boundary (new key) with the default control.
 */
export class FieldErrorBoundary extends Component<
  FieldErrorBoundaryProps,
  FieldErrorBoundaryState
> {
  override state: FieldErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): FieldErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onFieldError();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
