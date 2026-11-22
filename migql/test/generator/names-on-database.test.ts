import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { createMigql, lines } from '../support.js';
import { createBookshopDatabase } from './database.js';

const { parse, clear } = createMigql();
const { bookshop, rows, run, model } = createBookshopDatabase();

async function runPart(...body: string[]): Promise<void> {
    const document = await parse(lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line)));
    expect(document).toHaveNoErrors();
    await run(document.parseResult.value);
    await clear();
}

const columnsOf = async (table: string) => (await model()).tables.find(each => each.name === table)!.columns.map(column => column.name);

describe('Exact names on a database', () => {
    // M3.1-AC-20
    test('a change of case only is an ordinary rename', async () => {
        await bookshop('alter table customer add column key varchar(10)');

        await runPart('column-rename: { table: customer, from: key, to: Key }');

        expect(await columnsOf('customer')).toContain('Key');
        expect(await columnsOf('customer')).not.toContain('key');
    });

    // M3.1-AC-21
    test('two columns that differ only in case are changed one at a time', async () => {
        await bookshop(
            'alter table customer add column "Mail" varchar(255)',
            "insert into customer (id, name, mail, \"Mail\", created_at) values (1, 'Jo', 'lower', 'upper', now())");

        await runPart("do: update customer set Mail = 'changed' where mail = 'lower'");

        expect(await rows('select mail, "Mail" from customer')).toEqual([{ mail: 'lower', Mail: 'changed' }]);
    });

    // M3.1-AC-14
    test('a name in quotes is accepted in every position where a name can stand', async () => {
        await bookshop();

        await runPart('do: |', '  create table "Order Item" ("Line No" integer not null, "Book Id" bigint, constraint "PK Order Item" primary key ("Line No"),',
            '    constraint "FK Order Item Book" foreign key ("Book Id") references book (id))');
        await runPart('do: create index "IX Order Item" on "Order Item" ("Book Id")');
        await runPart('native:', '  postgresql: create sequence "Line Seq"');
        await runPart('insert:', '  into: "Order Item"', '  values:', '    "Line No": next value for "Line Seq"', '    "Book Id": null');
        await runPart('upsert:', '  into: "Order Item"', '  key: "Line No"', '  rows:', '    - { "Line No": 1, "Book Id": null }', '    - { "Line No": 2, "Book Id": null }');
        await runPart('do: |', '  update "Order Item" "The Item" set "Book Id" = (select "B".id from book "B" where "B".id = "The Item"."Line No")',
            '  where "The Item"."Line No" > 0');
        await runPart('do: delete from "Order Item" where "Line No" = 2');

        expect(await rows('select "Line No", "Book Id" from "Order Item"')).toEqual([{ 'Line No': 1, 'Book Id': null }]);
        const table = (await model()).tables.find(each => each.name === 'Order Item')!;
        expect(table.primaryKey).toEqual({ name: 'PK Order Item', columns: ['Line No'] });
        expect(table.foreignKeys.map(key => key.name)).toEqual(['FK Order Item Book']);
        expect(table.indexes.map(index => index.name)).toEqual(['IX Order Item']);
    });

    test('a name in quotes is accepted in a condition', async () => {
        const document = await parse(lines('migration: 20260302-0900-x',
            'when: column "Order Item"."Line No" exists and table "Order Item" exists and not index "IX Order Item" exists'));

        expect(document).toHaveNoErrors();
    });
});

/** Words of the language that a name may be made of, too. */
const KEYWORDS = ['select', 'table', 'Order', 'USER', 'null', 'check', 'value'];

const anyName = fc.oneof(
    fc.constantFrom(...KEYWORDS),
    fc.array(fc.constantFrom(...'abcXYZ019_ '.split(''), ...KEYWORDS), { minLength: 1, maxLength: 8 }).map(pieces => pieces.join('')),
).filter(name => name.trim().length > 0 && Buffer.byteLength(name) <= 63);

/** Quotes are written where the language needs them: for a keyword and for other characters. Elsewhere at random. */
function written(name: string, quote: boolean): string {
    return quote || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || KEYWORDS.map(word => word.toLowerCase()).includes(name.toLowerCase()) ? `"${name}"` : name;
}

// M3.1-AC-22
describe('Any name', () => {
    test('written in a snippet, created on the database and read back, is the same name', async () => {
        await bookshop();
        let count = 0;

        await fc.assert(fc.asyncProperty(anyName, fc.boolean(), async (name, quote) => {
            // Every run needs a table of its own. The number keeps names apart that PostgreSQL would cut to the same 63 bytes.
            const table = `${name}${++count}`.slice(-60);
            const column = name;

            await runPart(`do: create table ${written(table, true)} (${written(column, quote)} integer)`);

            const created = (await model()).tables.find(each => each.name === table);
            expect(created?.columns.map(each => each.name)).toEqual([column]);
        }), { seed: 20261122, numRuns: 60 });
    }, 120_000);
});
