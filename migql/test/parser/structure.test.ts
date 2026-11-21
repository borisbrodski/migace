import { describe, expect, test } from 'vitest';
import { isVerifyEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, lines } from '../support.js';

const { parse } = createMigql();

function part(...body: string[]): string {
    return lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

async function partEntries(...body: string[]): Promise<string[]> {
    const document = await parse(part(...body));
    expect(document).toHaveNoErrors();
    return partsOf(document.parseResult.value).flatMap(p => p.entries.map(entry => entry.$type));
}

describe('Parser: structure of a snippet', () => {
    // M1-AC-06
    test('all top-level keys are accepted, in any order', async () => {
        const document = await parse(lines(
            'doc: Customers can review books',
            'uid: 01JF4C9S2M7H5K3P8V6N1Y0E4R',
            'migration: 20260309-1400-review-table',
            'when: true',
            'let:',
            '  ready: true',
            'changed: A reason',
            'retired: Another reason',
            'requires-downtime: true',
            'testdata-before:',
            '  - table: review',
            'testdata:',
            '  - table: review',
            'parts:',
            '  - p:',
            '      do: update t set c = 1',
        ));

        expect(document).toHaveNoErrors();
        expect(document.parseResult.value.entries.map(entry => entry.$type)).toEqual([
            'DocEntry', 'UidEntry', 'NameEntry', 'WhenEntry', 'LetEntry', 'ChangedEntry', 'RetiredEntry',
            'RequiresDowntimeEntry', 'TestdataEntry', 'TestdataEntry', 'PartsEntry',
        ]);
    });

    test('a repair snippet starts with repair instead of migration', async () => {
        const document = await parse(lines('repair: 20260622-0900-repair-order-status'));

        expect(document).toHaveNoErrors();
        expect(document.parseResult.value.entries[0]).toMatchObject({ kind: 'repair:', name: '20260622-0900-repair-order-status' });
    });
});

describe('Parser: structure of a part', () => {
    // M1-AC-08
    test.each([
        [['do: update t set c = 1'], 'DoEntry'],
        [['insert:', '  into: review'], 'InsertEntry'],
        [['native:', '  postgresql: create extension if not exists pg_trgm'], 'NativeEntry'],
        [['stop: Restore the column from a backup.'], 'StopEntry'],
    ])('the operation %j is a %s', async (body, type) => {
        expect(await partEntries(...body)).toEqual([type]);
    });

    // M1-AC-10
    test('the keys beside the operation are accepted', async () => {
        expect(await partEntries(
            'when: true',
            'verify-before: true',
            'do: update t set c = 1',
            'verify-after: true',
            'batch: 20000 by id',
            'expect-rows: 0..50',
            'phase: finish',
            'todo: Choose a value for existing customers',
        )).toEqual([
            'WhenEntry', 'VerifyEntry', 'DoEntry', 'VerifyEntry', 'BatchEntry', 'ExpectRowsEntry', 'PhaseEntry', 'TodoEntry',
        ]);
    });

    // M1-AC-20
    test('verify accepts a list of checks with all, none, exists and single', async () => {
        const document = await parse(part(
            'do: update t set c = 1',
            'verify-after:',
            "  - all: orders.status_id is not null",
            "  - none: orders.status_text = ''",
            "  - single: order_status.code = 'UNKNOWN'",
            "  - exists: order_status.code = 'OPEN'",
        ));

        expect(document).toHaveNoErrors();
        const verify = partsOf(document.parseResult.value)[0].entries.filter(isVerifyEntry)[0];
        expect(verify.checks.map(check => check.quantifier)).toEqual(['all:', 'none:', 'single:', 'exists:']);
    });

    test('verify accepts a condition in a literal block', async () => {
        const document = await parse(part(
            'do: update t set c = 1',
            'verify-after: |',
            '  not exists (select 1 from orders o',
            '              where not exists (select 1 from order_status s where s.id = o.status_id))',
        ));

        expect(document).toHaveNoErrors();
    });

    test('a part may have no body yet', async () => {
        const document = await parse(lines('parts:', '  - first:', '  - second:'));

        expect(document.parseResult.lexerErrors).toEqual([]);
        expect(document.parseResult.parserErrors).toEqual([]);
    });
});
