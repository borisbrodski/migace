import { describe, expect, test } from 'vitest';
import { createMigql, error, lines } from '../support.js';

const ORDER_STATUS = lines(
    'migration: 20260518-1000-order-status',
    'parts:',
    '  - add-status-id:',
    '      do: alter table orders add column status_id bigint',
    '  - link-status:',
    '      do: update orders set status_id = 1 where status_id is null',
);

// M4.4-AC-39
describe('Conditions belong to parts', () => {
    test('"when" on a snippet is an error that proposes the parts, and a name under "let" for a shared condition', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260302-0900-x', '<<{|when|}>>: exists (select 1 from customer)', 'parts:', '  - p:', '      do: delete from t'));

        expect(parsed).toHaveDocumentIssues([
            error('"when" is no key of a snippet. A condition belongs to a part: put "when" on the parts that need it. ' +
                'When several parts share a condition, name it under "let" and write "when: <name>" on each part.', 0),
        ]);
    });

    test('"when" on a part is no error', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260302-0900-x', 'let:', '  has_customers: exists (select 1 from customer)',
            'parts:', '  - p:', '      when: has_customers', '      do: delete from t', '  - q:', '      when: has_customers', '      do: delete from u'));

        expect(parsed).toHaveNoIssues();
    });
});

// M4.4-AC-40
describe('A retired part', () => {
    test('is a part with a reason', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260302-0900-x', 'parts:', '  - p:', '      retired: The column is filled by the application now.', '      do: delete from t'));

        expect(parsed).toHaveNoIssues();
    });

    test('can be named by a condition', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(lines('migration: 20260518-1000-order-status', 'parts:', '  - link-status:', '      retired: Done by the application.',
            '      do: update orders set status_id = 1 where status_id is null'));

        const parsed = await parseMarked(lines('repair: 20260622-0900-repair-order-status', 'parts:', '  - p:', '      when: ran order-status.link-status', '      do: delete from t'));

        expect(parsed).toHaveNoIssues();
    });
});

// M4.4-AC-41
describe('"ran" names a part', () => {
    test('a whole snippet is an error that lists its parts', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS);

        const parsed = await parseMarked(lines('repair: 20260622-0900-repair-order-status', 'parts:', '  - p:', '      when: ran <<{|order-status|}>>', '      do: delete from t'));

        expect(parsed).toHaveDocumentIssues([
            error('"ran" names a part, not a whole snippet: a snippet can have parts that failed or did not run yet. ' +
                'The parts of "order-status": order-status.add-status-id, order-status.link-status.', 0),
        ]);
    });
});

// M4.4-AC-24
describe('"ran" names a part that runs before', () => {
    test('a part of a later snippet is an error that names both places', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS);

        const parsed = await parseMarked(lines('migration: 20260401-0830-orders-index', 'parts:', '  - index:', '      when: ran <<{|order-status.link-status|}>>', '      do: delete from t'));

        expect(parsed).toHaveDocumentIssues([
            error('"ran order-status.link-status" names a part that runs later: the part "link-status" of 20260518-1000-order-status runs after ' +
                'the part "index" of 20260401-0830-orders-index. A part can only wait for a part that runs before it.', 0),
        ]);
    });

    test('a later part of the same snippet, or the part itself, is an error', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260518-1000-order-status', 'parts:',
            '  - first:', '      when: ran <<{|order-status.second|}>>', '      do: delete from t',
            '  - second:', '      when: ran <<{|order-status.second|}>>', '      do: delete from u'));

        expect(parsed).toHaveDocumentIssues([
            error('"ran order-status.second" names a part that runs later: the part "second" of 20260518-1000-order-status runs after ' +
                'the part "first" of 20260518-1000-order-status. A part can only wait for a part that runs before it.', 0),
            error('"ran order-status.second" names the part itself. A part can only wait for a part that runs before it.', 1),
        ]);
    });

    test('an earlier snippet and an earlier part of the same snippet are no error', async () => {
        const { parse, parseMarked } = createMigql();
        await parse(ORDER_STATUS);

        const parsed = await parseMarked(lines('migration: 20260601-0900-later', 'parts:',
            '  - first:', '      when: ran order-status.link-status', '      do: delete from t',
            '  - second:', '      when: ran later.first', '      do: delete from u'));

        expect(parsed).toHaveNoIssues();
    });

    test('a condition under "let" counts for every part that uses it', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260518-1000-order-status', 'let:', '  linked: ran <<{|order-status.second|}>>', 'parts:',
            '  - first:', '      when: linked', '      do: delete from t',
            '  - second:', '      do: delete from u'));

        expect(parsed).toHaveDocumentIssues([
            error('"ran order-status.second" names a part that runs later: the part "second" of 20260518-1000-order-status runs after ' +
                'the part "first" of 20260518-1000-order-status. A part can only wait for a part that runs before it.', 0),
        ]);
    });

    test('a name under "let" that refers to itself does not stop the check', async () => {
        const { parseMarked } = createMigql();

        const parsed = await parseMarked(lines('migration: 20260518-1000-order-status', 'let:', '  a: b and ran order-status.first', '  b: a', 'parts:',
            '  - first:', '      do: delete from t', '  - second:', '      when: a', '      do: delete from u'));

        expect(parsed.document.diagnostics?.map(diagnostic => diagnostic.message)).toEqual([
            expect.stringMatching(/^The condition "a" refers to itself/), expect.stringMatching(/^The condition "b" refers to itself/)]);
    });
});
