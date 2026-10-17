import './UnknownBlock.css';

export interface UnknownBlockProps {
  /** The unregistered document node type being skipped. */
  type: string;
}

/**
 * Explicit fallback for document nodes whose type has no registered renderer
 * (FR-010): loud enough to notice, harmless to surrounding content, and shown
 * again when an extension is disposed while its nodes are on screen.
 */
export function UnknownBlock({ type }: UnknownBlockProps) {
  return (
    <div className="bldr-unknown-block" role="note">
      Unknown block type: <code>{type}</code>
    </div>
  );
}
