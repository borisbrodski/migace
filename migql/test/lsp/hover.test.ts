import { describe, test } from 'vitest';
import { expectHover } from 'langium/test';
import { createMigql, lines } from '../support.js';

const { services, parse } = createMigql();
const hover = expectHover(services.migql);

let count = 0;
function at(text: string, expected: string | RegExp | undefined) {
    return hover({
        text,
        index: 0,
        hover: expected,
        parseOptions: { documentUri: `file:///hover-${++count}/20260302-0900-x.migql.yaml` },
    });
}

const NAME = 'migration: 20260302-0900-x';

describe('Hover', () => {
    test('a name in a condition shows its definition', async () => {
        await at(lines(NAME, 'let:', '  has_old_status: column orders.status exists', 'when: not has_<|>old_status'),
            '```migql\nhas_old_status: column orders.status exists\n```');
    });

    test('the name of a part shows the PostgreSQL statement that will run', async () => {
        await at(lines(NAME, 'parts:', '  - fill-<|>ship-by:', '      do: |', '        update orders',
            '        set ship_by = cast(created_at as date) + days(3)', '        where ship_by is null'),
        '```sql\nupdate orders set ship_by = cast(created_at as date) + make_interval(days => 3) where ship_by is null;\n```');
    });

    test('a reference to a part shows the statement of that part', async () => {
        await parse(lines('migration: 20260518-1000-order-status', 'parts:', '  - link-status:', '      do: delete from orders'));

        await at(lines('repair: 20260622-0900-repair-order-status', 'when: ran order-status.link-<|>status from 1.2.0'),
            '```sql\ndelete from orders;\n```');
    });

    test('a part that is not generated yet says so', async () => {
        await at(lines(NAME, 'parts:', '  - ren<|>ame:', '      do: rename column customer.mail to email'),
            '"rename column" needs several steps. Its generation belongs to milestone M3.');
    });

    test('a key shows what it is for', async () => {
        await at(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      bat<|>ch: 20000 by id'),
            /^Runs a data statement in portions/);
        await at(lines(NAME, 'parts:', '  - p:', '      do: delete from t', '      verify-<|>after: true'),
            /^Fails the part after it ran if the condition is not true/);
    });
});
