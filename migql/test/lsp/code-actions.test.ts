import { describe, expect, test } from 'vitest';
import { clearDocuments } from 'langium/test';
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
    const fixed = TextDocument.applyEdits(document.textDocument, edits);
    // The corrected text takes the place of the original one.
    await clearDocuments(services.shared);
    return { titles: actions.map(action => action.title), fixed };
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

// M3.2-AC-21
describe('Quick fix: replace a do by its action', () => {
    function part(...body: string[]): string {
        return lines(NAME, 'parts:', '  - p:', ...body.map(line => '      ' + line));
    }

    test.each([
        [['do: alter table customer alter column loyalty_level set not null'],
            ['column-set-not-null: { table: customer, column: loyalty_level }']],
        [['do: alter table customer rename column mail to "E Mail"'],
            ['column-rename: { table: customer, from: mail, to: "E Mail" }']],
        [['do: alter table review add constraint fk_review_book foreign key (book_id) references book'],
            ['constraint-add-foreign-key: { name: fk_review_book, table: review, columns: book_id, references: book }']],
        [['do: |', '  alter table review', '  add constraint fk_review_book foreign key (book_id) references book (id)'],
            ['constraint-add-foreign-key: { name: fk_review_book, table: review, columns: book_id, references: book, referenced-columns: id }']],
        [['do: alter table book_price add constraint fk foreign key (book_id, currency) references book_edition (book_id, currency)'],
            ['constraint-add-foreign-key:', '  name: fk', '  table: book_price', '  columns: [book_id, currency]', '  references: book_edition', '  referenced-columns: [book_id, currency]']],
        [['do: alter table book add constraint ck_book_price check (price_cents >= 0)'],
            ['constraint-add-check:', '  name: ck_book_price', '  table: book', '  check: price_cents >= 0']],
    ])('%j', async (before, after) => {
        const { titles, fixed } = await quickFix(part(...before, 'when: true'));

        expect(titles).toEqual([`Use the action "${after[0].split(':')[0]}"`]);
        expect(fixed).toBe(part(...after, 'when: true'));
        expect(await validate(fixed)).toHaveNoIssues();
    });

    test('a constraint without a name has no quick fix, because the action needs the name', async () => {
        const { titles } = await quickFix(part('do: alter table review add foreign key (book_id) references book'));

        expect(titles).toEqual([]);
    });
});

describe('Quick fix: nothing to offer', () => {
    test('a problem without a fix gets no quick fix', async () => {
        const { titles } = await quickFix(lines(NAME, 'parts:', '  - p:', '      do: delete t'));

        expect(titles).toEqual([]);
    });
});
