import ts from 'typescript';
import type { RuntimeSnapshot, SourceElement } from '../contracts';
import { fingerprint } from '../fingerprint';

export interface InstrumentedSource {
  readonly source: string;
  readonly elements: readonly SourceElement[];
}

/** Deterministic source identities plus original-source offsets. Never executes source. */
export async function instrumentSource(
  snapshot: RuntimeSnapshot,
  modulePath: string,
  source: string,
): Promise<InstrumentedSource> {
  const file = ts.createSourceFile(
    modulePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    modulePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const elements: SourceElement[] = [];
  const insertions: { at: number; text: string }[] = [];
  const occurrences = new Map<string, number>();
  const nodes: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  function walk(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (node.arguments.length !== 1 || argument === undefined || !ts.isStringLiteral(argument))
        throw new Error(
          `Dynamic import expressions are not part of the managed module contract: ${modulePath}`,
        );
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) nodes.push(node);
    ts.forEachChild(node, walk);
  }
  walk(file);
  for (const node of nodes) {
    // Components do not necessarily forward attributes. Only actual DOM elements get a target.
    const tag = node.tagName.getText(file);
    if (!/^[a-z][a-z0-9-]*$/u.test(tag)) continue;
    if (
      node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(file).startsWith('data-ck-source'),
      )
    ) {
      throw new Error(`Reserved source identity attribute in ${modulePath}`);
    }
    const owner = ts.isJsxOpeningElement(node) ? node.parent : node;
    const signature = ts
      .createPrinter({ removeComments: true })
      .printNode(ts.EmitHint.Unspecified, owner, file);
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    const astNodeId = `s-${(await fingerprint({ modulePath, signature, occurrence })).slice(0, 24)}`;
    let ancestor: ts.Node = node.parent;
    let dynamic = false;
    while (!ts.isSourceFile(ancestor)) {
      if (ts.isCallExpression(ancestor) || ts.isConditionalExpression(ancestor)) dynamic = true;
      ancestor = ancestor.parent;
    }
    const staticText =
      ts.isJsxElement(owner) && owner.children.length > 0 && owner.children.every(ts.isJsxText)
        ? {
            start: owner.openingElement.end,
            end: owner.closingElement.getStart(file),
            source: source.slice(owner.openingElement.end, owner.closingElement.getStart(file)),
          }
        : undefined;
    elements.push({
      handle: {
        projectId: snapshot.projectId,
        modulePath,
        sourceRevision: snapshot.project.revision,
        astNodeId,
      },
      start: owner.getStart(file),
      end: owner.end,
      tag,
      dynamic,
      ...(staticText === undefined ? {} : { staticText }),
    });
    // Last explicit attribute wins over a preceding spread. User data cannot replace the handle.
    insertions.push({ at: node.attributes.end, text: ` data-ck-source="${astNodeId}"` });
  }
  let instrumented = source;
  for (const insertion of insertions.sort((left, right) => right.at - left.at)) {
    instrumented =
      instrumented.slice(0, insertion.at) + insertion.text + instrumented.slice(insertion.at);
  }
  return { source: instrumented, elements };
}
