import { type AstNode, AstUtils } from 'langium';
import type { LetDefinition, NameRef, Snippet } from '../generated/ast.js';
import { isLetDefinition, isLetEntry, isQuantifierCheck, isSelect, isSnippet, isStatement, isVerifyEntry, isWhenEntry } from '../generated/ast.js';

/**
 * Says what a name that stands alone means.
 *
 * In a condition (`when`, `let`, a `verify` condition) no table is in use, so the name is one
 * defined under `let`. Inside a statement, a subquery or a check on rows it is a column.
 */
export function isConditionName(reference: NameRef): boolean {
    for (let node: AstNode | undefined = reference.$container; node; node = node.$container) {
        if (isSelect(node) || isStatement(node) || isQuantifierCheck(node)) {
            return false;
        }
        if (isWhenEntry(node) || isLetDefinition(node) || isVerifyEntry(node)) {
            return true;
        }
    }
    return false;
}

export function letDefinitions(node: AstNode): LetDefinition[] {
    const snippet = AstUtils.getContainerOfType<Snippet>(node, isSnippet);
    return snippet?.entries.filter(isLetEntry).flatMap(entry => entry.definitions) ?? [];
}
