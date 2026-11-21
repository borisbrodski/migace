import { describe, expect, test } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { CodeAction } from 'vscode-languageserver';
import { createMigql, lines } from '../support.js';

const { services, validate } = createMigql();

/** The titles of the quick fixes for the problems of the text, and the text after the first one was applied. */
async function quickFix(text: string): Promise<{ titles: string[], fixed: string }> {
    const document = await validate(text);
    const diagnostics = document.diagnostics ?? [];
    const actions = await services.migql.lsp.CodeActionProvider!.getCodeActions(document, {
        textDocument: { uri: document.textDocument.uri },
        range: diagnostics[0].range,
        context: { diagnostics },
    }) as CodeAction[];
    const edits = actions[0]?.edit?.changes?.[document.textDocument.uri] ?? [];
    return { titles: actions.map(action => action.title), fixed: TextDocument.applyEdits(document.textDocument, edits) };
}

const NAME = 'migration: 20260302-0900-x';

describe('Quick fix: move a value into a literal block', () => {
    test('a statement with a # inside a text is moved below its key', async () => {
        const { titles, fixed } = await quickFix(lines(NAME, 'parts:', '  - p:', "      do: update t set a = 'x # y'", '      when: true'));

        expect(titles).toEqual(['Move the value into a literal block']);
        expect(fixed).toBe(lines(NAME, 'parts:', '  - p:', '      do: |', "        update t set a = 'x # y'", '      when: true'));
        expect(await validate(fixed)).toHaveNoIssues();
    });

    test('a text with a colon is moved below its key', async () => {
        const { fixed } = await quickFix(lines(NAME, 'doc: Note: the status moves into a table'));

        expect(fixed).toBe(lines(NAME, 'doc: |', '  Note: the status moves into a table'));
    });

    test('the value of a list item is indented below its key', async () => {
        const { fixed } = await quickFix(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      verify-after:', "        - none: t.a = 'x: y'"));

        expect(fixed).toBe(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      verify-after:', '        - none: |', "            t.a = 'x: y'"));
        expect(await validate(fixed)).toHaveNoIssues();
    });
});

describe('Quick fix: mark an open decision', () => {
    test('a part with a ? gets a todo', async () => {
        const { titles, fixed } = await quickFix(lines(NAME, 'parts:', '  - fill-existing:', '      do: update customer set loyalty_level = ?'));

        expect(titles).toEqual(['Add "todo" to the part']);
        expect(fixed).toBe(lines(NAME, 'parts:', '  - fill-existing:', '      todo: Decide the value', '      do: update customer set loyalty_level = ?'));
        expect(await validate(fixed)).toHaveNoIssues();
    });
});

describe('Quick fix: nothing to offer', () => {
    test('a problem without a fix gets no quick fix', async () => {
        const { titles } = await quickFix(lines(NAME, 'parts:', '  - p:', '      do: delete t'));

        expect(titles).toEqual([]);
    });
});
