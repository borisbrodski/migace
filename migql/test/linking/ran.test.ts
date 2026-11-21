import { describe, expect, test } from 'vitest';
import { isRanCondition, isWhenEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, error, lines } from '../support.js';

const ORDER_STATUS = lines(
    'migration: 20260518-1000-order-status',
    'parts:',
    '  - add-status-id:',
    '      do: alter table orders add column status_id bigint',
    '  - link-status:',
    '      do: update orders set status_id = 1 where status_id is null',
);

// M1-AC-19
describe('Linking: ran <snippet>.<part>', () => {
    test('the reference names the snippet without date and time, and is linked to the part', async () => {
        const { parse } = createMigql();
        const orderStatus = await parse(ORDER_STATUS);

        const repair = await parse(lines('repair: 20260622-0900-repair-order-status', 'when: ran order-status.link-status from 1.2.0'));

        const condition = repair.parseResult.value.entries.filter(isWhenEntry)[0].condition;
        expect(isRanCondition(condition) && condition.part.ref).toBe(partsOf(orderStatus.parseResult.value)[1]);
    });

    test('the reference still works after the snippet was moved to another date', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS.replace('20260518-1000', '20260510-0800'));

        const parsed = await parseMarked(lines('repair: 20260622-0900-repair-order-status', 'when: ran order-status.link-status'));

        expect(parsed).toHaveNoIssues();
    });

    test('a part of the same snippet can be named', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines(
            'migration: 20260518-1000-order-status', 'parts:', '  - first:', '      do: delete from t', '  - second:',
            '      when: ran order-status.first', '      do: delete from u',
        ));

        expect(parsed).toHaveNoIssues();
    });

    test('a snippet that does not exist is an error', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS);

        const parsed = await parseMarked(lines('repair: 20260622-0900-repair-order-status', 'when: ran <<{|orders-status.link-status|}>>'));

        expect(parsed).toHaveDocumentIssues([
            error('No snippet is named "orders-status". Name the snippet without its date and time, then the part: <snippet>.<part>.', 0),
        ]);
    });

    test('a part that does not exist is an error that lists the parts of the snippet', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS);

        const parsed = await parseMarked(lines('repair: 20260622-0900-repair-order-status', 'when: ran <<{|order-status.backfill|}>>'));

        expect(parsed).toHaveDocumentIssues([
            error('The snippet "order-status" has no part "backfill". Its parts: add-status-id, link-status.', 0),
        ]);
    });
});
