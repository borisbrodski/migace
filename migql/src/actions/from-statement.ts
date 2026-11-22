import { type AstNode, GrammarUtils } from 'langium';
import type { Statement } from '../generated/ast.js';

/** An action that has the same result as a statement under `do`. */
export interface ActionForStatement {
    action: string;
    /** What the plain statement does that the action avoids. */
    reason: string;
    /** The action as it is written in a part: one line, or the key and one parameter per line. Missing if the statement lacks something the action needs. */
    lines?: string[];
}

/** Finds the action for a statement, if there is one. A statement with a syntax error may lack any of its pieces. */
export function actionForStatement(statement: Statement | undefined): ActionForStatement | undefined {
    if (statement?.$type !== 'AlterTable' || !statement.action) {
        return undefined;
    }
    const table = written(statement, 'table');
    const change = statement.action;
    if (change.$type === 'AlterColumn' && change.change?.$type === 'SetNotNull') {
        return {
            action: 'column-set-not-null',
            reason: 'It reads all rows while nobody can use the table.',
            lines: [`column-set-not-null: { table: ${table}, column: ${written(change, 'column')} }`],
        };
    }
    if (change.$type === 'RenameColumn') {
        return {
            action: 'column-rename',
            reason: 'An older version of the application that still runs does not find the column any more.',
            lines: [`column-rename: { table: ${table}, from: ${written(change, 'column')}, to: ${written(change, 'newName')} }`],
        };
    }
    if (change.$type !== 'AddConstraint' || !change.constraint?.rule) {
        return undefined;
    }
    const constraint = change.constraint;
    const name = constraint.name ? written(constraint, 'name') : undefined;
    const rule = constraint.rule;
    if (rule.$type === 'ForeignKey') {
        const columns = allWritten(rule, 'columns');
        const referenced = allWritten(rule, 'referenced');
        const parameters = [
            ['name', name ?? ''], ['table', table], ['columns', list(columns)], ['references', written(rule, 'table')],
            ...(referenced.length > 0 ? [['referenced-columns', list(referenced)]] : []),
        ];
        const onOneLine = columns.length === 1 && referenced.length <= 1;
        return {
            action: 'constraint-add-foreign-key',
            reason: 'It checks all rows while nobody can change the table.',
            lines: name === undefined ? undefined : onOneLine
                ? [`constraint-add-foreign-key: { ${parameters.map(([key, value]) => `${key}: ${value}`).join(', ')} }`]
                : ['constraint-add-foreign-key:', ...parameters.map(([key, value]) => `  ${key}: ${value}`)],
        };
    }
    if (rule.$type === 'Check') {
        const condition = (rule.condition.$cstNode?.text ?? '').replace(/\s+/g, ' ');
        return {
            action: 'constraint-add-check',
            reason: 'It checks all rows while nobody can use the table.',
            lines: name === undefined ? undefined : ['constraint-add-check:', `  name: ${name}`, `  table: ${table}`, `  check: ${condition}`],
        };
    }
    return undefined;
}

/** One name, or a list of names in square brackets. */
function list(names: string[]): string {
    return names.length === 1 ? names[0] : `[${names.join(', ')}]`;
}

/** A name as the author wrote it, with its quotes if it has some. */
function written(node: AstNode, property: string): string {
    return GrammarUtils.findNodeForProperty(node.$cstNode, property)?.text ?? '';
}

function allWritten(node: AstNode, property: string): string[] {
    return GrammarUtils.findNodesForProperty(node.$cstNode, property).map(each => each.text);
}
