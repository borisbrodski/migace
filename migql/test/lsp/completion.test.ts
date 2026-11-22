import { describe, expect, test } from 'vitest';
import { expectCompletion } from 'langium/test';
import { createMigql, lines } from '../support.js';

const { services, parse } = createMigql();
const completion = expectCompletion(services.migql);

/** The labels that are offered at the place marked with <|>. */
async function offered(text: string): Promise<string[]> {
    let labels: string[] = [];
    await completion({
        text,
        index: 0,
        parseOptions: { documentUri: `file:///completion-${Math.random()}/20260302-0900-x.migql.yaml` },
        assert: completions => {
            labels = completions.items.map(item => item.label);
        },
    });
    return labels;
}

const NAME = 'migration: 20260302-0900-x';

describe('Completion: keys', () => {
    test('an empty file offers the keys of a snippet', async () => {
        expect(await offered('<|>')).toEqual(expect.arrayContaining(['migration:', 'repair:', 'uid:', 'doc:', 'parts:', 'testdata:']));
    });

    test('a new line at the start offers the keys of a snippet', async () => {
        const labels = await offered(lines(NAME, '<|>'));

        expect(labels).toEqual(expect.arrayContaining(['uid:', 'doc:', 'when:', 'let:', 'parts:', 'testdata:', 'testdata-before:']));
        expect(labels).not.toContain('do:');
    });

    test('inside a part the keys of a part are offered', async () => {
        const labels = await offered(lines(NAME, 'parts:', '  - p:', '      <|>'));

        expect(labels).toEqual(expect.arrayContaining(['do:', 'insert:', 'native:', 'stop:', 'when:', 'verify-before:', 'verify-after:', 'batch:', 'expect-rows:', 'phase:', 'todo:']));
        expect(labels).not.toContain('uid:');
    });

    test('after an entry of a part the keys of a part are offered again', async () => {
        const labels = await offered(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      <|>'));

        expect(labels).toEqual(expect.arrayContaining(['when:', 'verify-after:', 'batch:']));
    });

    test('the start of a key narrows the offer', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      ver<|>'))).toEqual(['verify-before:', 'verify-after:']);
    });
});

describe('Completion: statements', () => {
    test('after do the statements are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: <|>')))
            .toEqual(expect.arrayContaining(['create', 'alter', 'drop', 'update', 'delete', 'insert']));
    });

    test('inside a statement the next keywords are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: alter table orders <|>'))).toEqual(['add', 'drop', 'alter', 'rename']);
    });

    test('inside a literal block the next keywords are offered', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: |', '        alter table orders', '          alter column total_cents s<|>')))
            .toEqual(['set']);
    });
});

// M1.1-AC-18
describe('Completion: fixed values', () => {
    test('fill offers its two modes', async () => {
        expect(await offered(lines(NAME, 'testdata:', '  - table: review', '    fill: <|>'))).toEqual(['all', 'required']);
    });

    test('phase offers finish', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      phase: <|>'))).toEqual(['finish']);
    });

    test('requires-downtime offers true and false', async () => {
        expect(await offered(lines(NAME, 'requires-downtime: <|>'))).toEqual(['true', 'false']);
    });
});

describe('Completion: names', () => {
    test('a condition offers the names defined under let', async () => {
        const labels = await offered(lines(NAME, 'let:', '  has_old_status: column orders.status exists', '  audited: true', 'when: <|>'));

        expect(labels).toEqual(expect.arrayContaining(['has_old_status', 'audited', 'not', 'ran', 'column', 'table', 'exists']));
    });

    test('after ran the parts of all snippets are offered', async () => {
        await parse(lines('migration: 20260518-1000-order-status', 'parts:', '  - add-status-id:', '      do: delete from t', '  - link-status:', '      do: delete from t'));

        expect(await offered(lines('repair: 20260622-0900-repair-order-status', 'when: ran <|>')))
            .toEqual(expect.arrayContaining(['order-status.add-status-id', 'order-status.link-status']));
    });
});

/** The completion items at the place marked with <|>. */
async function items(text: string) {
    let found: import('vscode-languageserver').CompletionItem[] = [];
    await completion({
        text,
        index: 0,
        parseOptions: { documentUri: `file:///completion-${Math.random()}/20260302-0900-x.migql.yaml` },
        assert: completions => {
            found = completions.items;
        },
    });
    return found;
}

// M3.2-AC-25
describe('Completion: operations of a part', () => {
    test('the place of the operation lists do, insert, upsert, native and every action, each with its summary', async () => {
        const offer = await items(lines(NAME, 'parts:', '  - p:', '      <|>'));
        const summaries = Object.fromEntries(offer.map(item => [item.label, item.detail]));

        expect(summaries).toMatchObject({
            'do:': 'One statement in the statement language.',
            'insert:': 'Inserts rows, written as YAML: `into`, and `values` for one row or `rows` for several.',
            'upsert:': 'Inserts the rows that are missing and updates the rows that exist, found by `key`.',
            'native:': 'SQL in the dialect of one database, one entry per database.',
            'column-ensure:': 'Makes sure that a column exists with at least the given type.',
            'column-rename:': 'Gives a column another name.',
            'column-set-not-null:': 'Makes a column mandatory without blocking the table while its rows are read.',
            'constraint-add-check:': 'Adds a check constraint without blocking the table while its rows are checked.',
            'constraint-add-foreign-key:': 'Adds a foreign key without blocking the table while its rows are checked.',
        });
    });

    test('typing col leaves the actions for columns', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      col<|>'))).toEqual(['column-ensure:', 'column-rename:', 'column-set-not-null:']);
    });

    // M3.2-AC-27
    test('an action is inserted with its mandatory parameters as places to fill in', async () => {
        const offer = await items(lines(NAME, 'parts:', '  - p:', '      column-ren<|>'));

        expect(offer.map(item => [item.label, item.insertTextFormat, item.textEdit && 'newText' in item.textEdit ? item.textEdit.newText : item.insertText])).toEqual([
            ['column-rename:', 2, 'column-rename: { table: ${1:table}, from: ${2:from}, to: ${3:to} }'],
        ]);
    });

    test('a statement that became an action is not offered after do', async () => {
        const labels = await offered(lines(NAME, 'parts:', '  - p:', '      do: <|>'));

        expect(labels).toEqual(expect.arrayContaining(['create', 'alter', 'drop', 'update', 'delete', 'insert']));
        expect(labels).not.toContain('ensure');
        expect(labels).not.toContain('rename');
    });
});

// M3.2-AC-26
describe('Completion: parameters of an action', () => {
    test('a block lists the parameters that are still missing, the mandatory ones first', async () => {
        const offer = await items(lines(NAME, 'parts:', '  - p:', '      column-ensure:', '        column: note', '        <|>'));

        expect(offer.map(item => [item.label, item.detail])).toEqual([
            ['table', 'The table that gets the column.'],
            ['type', 'The type the column must have, for example `varchar(500)`.'],
            ['default', 'Optional. The default value of the column, used when the column is added.'],
            ['not-null', 'Optional. `true` makes the column mandatory when it is added.'],
        ]);
        expect(offer.map(item => item.sortText)).toEqual([...offer.map(item => item.sortText)].sort());
    });

    test('the form on one line lists them too', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      column-rename: { table: customer, <|>'))).toEqual(['from', 'to']);
    });

    test('the start of a parameter narrows the offer', async () => {
        expect(await offered(lines(NAME, 'parts:', '  - p:', '      constraint-add-foreign-key:', '        name: fk', '        re<|>'))).toEqual(['references', 'referenced-columns']);
    });
});
