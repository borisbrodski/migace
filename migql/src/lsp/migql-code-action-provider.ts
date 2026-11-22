import { AstUtils, CstUtils, type LangiumDocument } from 'langium';
import { actionForStatement } from '../actions/from-statement.js';
import { type DoEntry, isDoEntry } from '../generated/ast.js';
import type { CodeActionProvider } from 'langium/lsp';
import type { CodeAction, CodeActionParams, Diagnostic, TextEdit } from 'vscode-languageserver';
import { CodeActionKind } from 'vscode-languageserver';
import { LITERAL_BLOCK_ADVICE } from '../lexer/migql-lexer.js';
import { IssueCodes } from '../validation/migql-validator.js';

/** Quick fixes for problems whose solution needs no decision of the author. */
export class MigqlCodeActionProvider implements CodeActionProvider {

    getCodeActions(document: LangiumDocument, params: CodeActionParams): CodeAction[] {
        return params.context.diagnostics.flatMap(diagnostic => {
            const fix = this.fixFor(diagnostic, document);
            return fix ? [{
                title: fix.title,
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                isPreferred: true,
                edit: { changes: { [document.textDocument.uri]: [fix.edit] } },
            }] : [];
        });
    }

    private actionInPlaceOfDo(diagnostic: Diagnostic, document: LangiumDocument): { title: string, edit: TextEdit } | undefined {
        const root = document.parseResult.value.$cstNode!;
        const leaf = CstUtils.findLeafNodeAtOffset(root, document.textDocument.offsetAt(diagnostic.range.start));
        const entry = AstUtils.getContainerOfType(leaf?.astNode, isDoEntry);
        const action = entry ? actionForStatement(entry.statement) : undefined;
        return entry && action?.lines ? { title: `Use the action "${action.action}"`, edit: replaceEntry(entry, action.lines) } : undefined;
    }

    private fixFor(diagnostic: Diagnostic, document: LangiumDocument): { title: string, edit: TextEdit } | undefined {
        const line = diagnostic.range.start.line;
        const text = document.textDocument.getText({ start: { line, character: 0 }, end: { line: line + 1, character: 0 } }).replace(/\r?\n$/, '');
        if (typeof diagnostic.message === 'string' && diagnostic.message.endsWith(LITERAL_BLOCK_ADVICE)) {
            return { title: 'Move the value into a literal block', edit: intoLiteralBlock(line, text) };
        }
        if (diagnostic.code === IssueCodes.DoHasAction) {
            return this.actionInPlaceOfDo(diagnostic, document);
        }
        if (diagnostic.code === IssueCodes.PlaceholderWithoutTodo) {
            const indentation = /^\s*/.exec(text)![0];
            return {
                title: 'Add "todo" to the part',
                edit: { range: { start: { line, character: 0 }, end: { line, character: 0 } }, newText: `${indentation}todo: Decide the value\n` },
            };
        }
        return undefined;
    }
}

/** The lines of an action in the place of a `do` entry, indented like the entry. */
function replaceEntry(entry: DoEntry, lines: string[]): TextEdit {
    const range = entry.$cstNode!.range;
    const indentation = ' '.repeat(range.start.character);
    return { range, newText: lines.map((line, index) => (index === 0 ? line : indentation + line)).join('\n') };
}

/** `key: value` becomes `key: |` with the value on the next line, indented below the key. */
function intoLiteralBlock(line: number, text: string): TextEdit {
    const entry = /^(\s*(?:-[ ]+)?)[\w-]+:[ ]+/.exec(text)!;
    const keyColumn = entry[1].length;
    const value = text.substring(entry[0].length).trimEnd();
    return {
        range: { start: { line, character: entry[0].length }, end: { line, character: text.length } },
        newText: `|\n${' '.repeat(keyColumn + 2)}${value}`,
    };
}
