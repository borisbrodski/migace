import { describe, expect, test } from 'vitest';
import { isDocEntry, isDoEntry, isFillEntry, isInsertEntry, isUpsertEntry, isKeyEntry, isNativeEntry, isRowEntry, isStopEntry, isTestdataEntry } from '../../src/generated/ast.js';
import type { Snippet } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { printExpression } from '../expression-printer.js';
import { createMigql, DIAGNOSTICS_ONLY, error, lines } from '../support.js';

const { parse, parseMarked, clear } = createMigql();

function part(...body: string[]): string {
    return lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

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

    // M1.1-AC-18
    test('fill accepts all and required only', async () => {
        const document = await parse(lines(NAME, 'testdata:', '  - table: review', '    fill: all', '  - table: review', '    fill: required'));
        expect(document).toHaveNoErrors();
        expect(document.parseResult.value.entries.filter(isTestdataEntry)[0].rows.map(row => row.entries.filter(isFillEntry)[0].mode))
            .toEqual(['all', 'required']);
        await clear();

        const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: review', '    fill: <<{|some|}>>'));
        expect(parsed).toHaveDocumentIssues([error('Expected "all" or "required", but found "some".', 0)], DIAGNOSTICS_ONLY);
    });

    // M1.1-AC-14
    test.each(["'x'", '1', '-1', '4.5', 'null', 'true', "date '2026-01-31'", 'any', 'maria.id', 'status'])(
        'a value in a flow map may be %s', async value => {
            const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: review', `    row: { a: ${value} }`));

            expect(parsed).toHaveNoIssues();
        });

    // M1.1-AC-14
    test.each(['coalesce(x, 1)', "upper('a')", '1 + 2', '(select max(id) from t)', 'next value for s', '(1)'])(
        'a value in a flow map may not be %s', async value => {
            const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: review', `    row: { a: <<{|${value}|}>>, b: 1 }`));

            expect(parsed).toHaveDocumentIssues([
                error('A flow map holds only literals, names and table.column. Write the values in the block form, one line per column.', 0),
            ]);
        });

    test('the same values are accepted in the block form', async () => {
        const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: review', '    row:', '      a: coalesce(x, 1)', '      b: 1 + 2'));

        expect(parsed).toHaveNoIssues();
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

// M1.1-AC-11, M1.1-AC-12
describe('Parser: upsert', () => {
    test('upsert has into, key and rows', async () => {
        const document = await parse(part(
            'upsert:', '  into: order_status', '  key: code', '  rows:', "    - { code: 'OPEN', label: 'Open' }", "    - { code: 'PAID', label: 'Paid' }",
        ));

        expect(document).toHaveNoErrors();
        const upsert = partsOf(document.parseResult.value)[0].entries.filter(isUpsertEntry)[0];
        expect(upsert.entries.map(entry => entry.$type)).toEqual(['IntoEntry', 'KeyEntry', 'RowsEntry']);
        expect(upsert.entries.filter(isKeyEntry)[0].columns).toEqual(['code']);
    });

    test('the key may be a list of columns', async () => {
        const parsed = await parseMarked(part(
            'upsert:', '  into: book_price', '  key: [book_id, currency]', '  rows:', "    - { book_id: 1, currency: 'EUR', price_cents: 990 }",
        ));

        expect(parsed).toHaveNoIssues();
        const upsert = partsOf(parsed.document.parseResult.value as Snippet)[0].entries.filter(isUpsertEntry)[0];
        expect(upsert.entries.filter(isKeyEntry)[0].columns).toEqual(['book_id', 'currency']);
    });

    test('upsert is an operation: a part needs nothing else', async () => {
        const parsed = await parseMarked(part('upsert:', '  into: order_status', '  key: code', '  rows:', "    - { code: 'OPEN' }"));

        expect(parsed).toHaveNoIssues();
    });

    test('a row without a value for a key column is an error at that row', async () => {
        const parsed = await parseMarked(part(
            'upsert:', '  into: book_price', '  key: [book_id, currency]', '  rows:',
            "    - { book_id: 1, currency: 'EUR', price_cents: 990 }", '    - <<{|{ book_id: 2, price_cents: 990 }|}>>', '    - <<{|{ price_cents: 5 }|}>>',
        ));

        expect(parsed).toHaveDocumentIssues([
            error('This row has no value for the key column "currency". Every row of an upsert gives all key columns.', 0),
            error('This row has no value for the key columns "book_id" and "currency". Every row of an upsert gives all key columns.', 1),
        ]);
    });

    test.each([
        [['upsert:', '  <<{|into|}>>: order_status', '  rows:', "    - { code: 'OPEN' }"], 'An upsert needs "key": the column, or the list of columns, by which an existing row is found.'],
        [['upsert:', '  <<{|key|}>>: code', '  rows:', "    - { code: 'OPEN' }"], 'An upsert needs "into": the table.'],
        [['upsert:', '  <<{|into|}>>: order_status', '  key: code'], 'An upsert needs "rows": the list of rows.'],
    ])('an upsert without one of its keys is an error', async (body, message) => {
        const parsed = await parseMarked(part(...body));

        expect(parsed).toHaveDocumentIssues([error(message, 0)]);
    });
});

// M1.1-AC-16
describe('Parser: names in double quotes', () => {
    test('a name in double quotes may be a keyword', async () => {
        const document = await parse(part('do: |', '  update "order" o set "index" = "table"."column", "Mixed Case" = 1 where o."check" is null'));

        expect(document).toHaveNoErrors();
        const statement = partsOf(document.parseResult.value)[0].entries.filter(isDoEntry)[0].statement;
        expect(statement).toMatchObject({ table: 'order', assignments: [{ column: 'index' }, { column: 'Mixed Case' }] });
    });

    test('a keyword without quotes is an error that advises the quotes', async () => {
        const parsed = await parseMarked(part('do: alter table orders add column <<{|where|}>> integer'));

        expect(parsed).toHaveDocumentIssues([
            error('Expected a name, but found "where". "where" is a keyword. To use it as a name, write it in double quotes: "where".', 0),
        ], DIAGNOSTICS_ONLY);
    });
});

// M1.1-AC-19
describe('Parser: behaviour that the syntax decisions keep', () => {
    test('both spellings of a type change give the same syntax tree', async () => {
        const short = await parse(part('do: alter table orders alter column total_cents type bigint'));
        const long = await parse(part('do: alter table orders alter column total_cents set data type bigint'));

        const change = (document: typeof short) => {
            const statement = partsOf(document.parseResult.value as Snippet)[0].entries.filter(isDoEntry)[0].statement as unknown as { action: { change: { $type: string, type: { name: string } } } };
            return { type: statement.action.change.$type, target: statement.action.change.type.name };
        };
        expect(change(short)).toEqual({ type: 'SetType', target: 'bigint' });
        expect(change(long)).toEqual(change(short));
    });

    test('a comment after a one-line statement is accepted', async () => {
        const parsed = await parseMarked(part('do: delete from order_item where quantity = 0 # leftovers of an old bug'));

        expect(parsed).toHaveNoIssues();
    });

    test('? is accepted only in a part with a todo', async () => {
        expect(await parseMarked(part('todo: Choose a value', 'do: update customer set loyalty_level = ?'))).toHaveNoIssues();
        await clear();
        expect(await parseMarked(part('do: update customer set loyalty_level = <<{|?|}>>'))).toHaveDocumentIssues([
            error(/^A "\?" stands for a value that is not decided yet/, 0),
        ]);
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

    // M1.1-AC-03
    test('the value of a literal block is the same with Windows line endings', async () => {
        const text = lines(NAME, 'doc: |', '  First line.', '    Second line.');

        const document = await parse(text.replace(/\n/g, '\r\n'));

        expect(document.parseResult.value.entries.filter(isDocEntry)[0].text).toBe('First line.\n  Second line.\n');
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
