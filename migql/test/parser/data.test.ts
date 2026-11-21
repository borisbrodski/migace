import { describe, expect, test } from 'vitest';
import { isDocEntry, isInsertEntry, isNativeEntry, isRowEntry, isStopEntry, isTestdataEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { printExpression } from '../expression-printer.js';
import { createMigql, error, lines } from '../support.js';

const { parse, parseMarked } = createMigql();

const NAME = 'migration: 20260302-0900-x';

// M1-AC-22
describe('Parser: test data', () => {
    test('an entry has a table, a fill mode and a row', async () => {
        const document = await parse(lines(
            NAME,
            'testdata-before:',
            '  - table: orders',
            '    fill: all',
            "    row: { status: 'shipped ', customer_id: maria.id, book_id: any }",
            '  - table: orders',
            '    as: second_order',
            '    fill: required',
        ));

        expect(document).toHaveNoErrors();
        const rows = document.parseResult.value.entries.filter(isTestdataEntry)[0].rows;
        expect(rows.map(row => row.entries.map(entry => entry.$type))).toEqual([
            ['TableEntry', 'FillEntry', 'RowEntry'], ['TableEntry', 'AsEntry', 'FillEntry'],
        ]);
        const row = rows[0].entries.filter(isRowEntry)[0];
        expect(row.map?.values.map(value => `${value.column}=${printExpression(value.value)}`)).toEqual([
            "status='shipped '", 'customer_id=maria.id', 'book_id=any',
        ]);
    });

    test('a row may be written as a block', async () => {
        const document = await parse(lines(
            NAME, 'testdata:', '  - table: review', '    row:', '      stars: 5', "      review_text: 'Could not put it down.'",
        ));

        expect(document).toHaveNoErrors();
        const row = document.parseResult.value.entries.filter(isTestdataEntry)[0].rows[0].entries.filter(isRowEntry)[0];
        expect(row.values.map(value => `${value.column}=${printExpression(value.value)}`)).toEqual([
            'stars=5', "review_text='Could not put it down.'",
        ]);
    });

    test('an empty flow map is a row without own values', async () => {
        const document = await parse(lines(NAME, 'testdata:', '  - table: review', '    row: {}'));

        expect(document).toHaveNoErrors();
    });

    test('fill accepts all and required only', async () => {
        const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: review', '    fill: <<{|some|}>>'));

        expect(parsed).toHaveDocumentIssues([error('The fill mode is "all" (every column has a value) or "required" (only mandatory columns).', 0)]);
    });
});

// M1-AC-23
describe('Parser: insert in YAML form', () => {
    test('one row is written as values', async () => {
        const document = await parse(lines(
            NAME, 'parts:', '  - add-unknown-status:', '      insert:', '        into: order_status', '        values:',
            '          id:    next value for bookshop_seq', "          code:  'UNKNOWN'", '          table: (select max(id) from order_status)',
        ));

        expect(document).toHaveNoErrors();
        const insert = partsOf(document.parseResult.value)[0].entries.filter(isInsertEntry)[0];
        expect(insert.entries.map(entry => entry.$type)).toEqual(['IntoEntry', 'ValuesEntry']);
    });

    test('several rows are written as a list of flow maps', async () => {
        const document = await parse(lines(
            NAME, 'parts:', '  - add-statuses:', '      insert:', '        into: order_status', '        rows:',
            "          - { id: 1, code: 'OPEN',    label: 'Open' }", "          - { id: 2, code: 'PAID',    label: 'Paid' }",
        ));

        expect(document).toHaveNoErrors();
    });
});

// M1-AC-11, M1-AC-24, M1-AC-25
describe('Parser: free text', () => {
    test('the value of doc on one line is its text', async () => {
        const document = await parse(lines(NAME, "doc: Add orders.due_date; it's computed (100%)   "));

        expect(document.parseResult.value.entries.filter(isDocEntry)[0].text).toBe("Add orders.due_date; it's computed (100%)");
    });

    test('the value of a literal block is its lines without their indentation', async () => {
        const document = await parse(lines(
            NAME, 'parts:', '  - no-audit-data:', '      stop: |', '        No audit rows. Restore orders.status from backup,',
            '          then mark this snippet as done.', '', '        Call us.', '',
        ));

        expect(partsOf(document.parseResult.value)[0].entries.filter(isStopEntry)[0].message)
            .toBe('No audit rows. Restore orders.status from backup,\n  then mark this snippet as done.\n\nCall us.\n');
    });

    test('native SQL is kept as text and is not parsed', async () => {
        const document = await parse(lines(
            NAME, 'parts:', '  - title-search-index:', '      native:', '        postgresql: |',
            '          create index ix_book_title_search on book', '          using gin (title gin_trgm_ops) -- ~~ anything',
            '        oracle: select 1 from dual',
        ));

        expect(document).toHaveNoErrors();
        const native = partsOf(document.parseResult.value)[0].entries.filter(isNativeEntry)[0];
        expect(native.variants.map(variant => [variant.dialect, variant.sql])).toEqual([
            ['postgresql', 'create index ix_book_title_search on book\nusing gin (title gin_trgm_ops) -- ~~ anything\n'],
            ['oracle', 'select 1 from dual'],
        ]);
    });
});

describe('Parser: open decisions', () => {
    test('a part with a todo may use ? in place of a value', async () => {
        const parsed = await parseMarked(lines(
            NAME, 'parts:', '  - fill-existing:', '      todo: Choose a value for existing customers', '      do: update customer set loyalty_level = ?',
        ));

        expect(parsed).toHaveNoErrors();
    });

    test('without a todo a ? is an error', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - fill-existing:', '      do: update customer set loyalty_level = <<{|?|}>>'));

        expect(parsed).toHaveDocumentIssues([
            error('A "?" stands for a value that is not decided yet. Write the value, or add "todo: <what is open>" to the part.', 0),
        ]);
    });
});
