import { describe, expect, test } from 'vitest';
import { isDoEntry, isUpdate, isWhenEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { printExpression } from '../expression-printer.js';
import { createMigql, lines } from '../support.js';

const { parse } = createMigql();

/** Parses the expression as the value of an assignment and prints how it was grouped. */
async function expression(text: string): Promise<string> {
    const document = await parse(lines(
        'migration: 20260302-0900-x', 'parts:', '  - p:', '      do: |', '        update t set c =', `          ${text}`,
    ));
    expect(document).toHaveNoErrors();
    const statement = partsOf(document.parseResult.value)[0].entries.filter(isDoEntry)[0].statement;
    if (!isUpdate(statement)) {
        throw new Error('Expected an update.');
    }
    return printExpression(statement.assignments[0].value);
}

/** Parses the text as the condition of a snippet and prints how it was grouped. */
async function condition(text: string): Promise<string> {
    const document = await parse(lines('migration: 20260302-0900-x', `when: ${text}`));
    expect(document).toHaveNoErrors();
    return printExpression(document.parseResult.value.entries.filter(isWhenEntry)[0].condition);
}

// M1-AC-19
describe('Parser: conditions', () => {
    test.each([
        ['column orders.status exists', 'column-exists(orders.status)'],
        ['table order_status_legacy exists', 'table-exists(order_status_legacy)'],
        ['not index ix_orders_customer exists', '(not index-exists(ix_orders_customer))'],
        ['ran order-status.link-status', 'ran(order-status.link-status)'],
        ['ran order-status.link-status from 1.2.0', 'ran(order-status.link-status from 1.2.0)'],
        ['column a.b exists and not ran x-1.y from 2.0 or audited', '((column-exists(a.b) and (not ran(x-1.y from 2.0))) or audited)'],
        ['exists (select 1 from orders where ship_by is null)', 'exists(<select 1 from orders where (ship_by is null)>)'],
        ['(select count(*) from orders) > 0', '(<select count(*) from orders> > 0)'],
    ])('%s', async (text, grouped) => {
        expect(await condition(text)).toBe(grouped);
    });
});

// M1-AC-16
describe('Parser: expressions', () => {
    test.each([
        // literals
        ["'BRONZE'", "'BRONZE'"],
        ["'it''s'", "'it's'"],
        ['42', '42'],
        ['4.25', '4.25'],
        ["date '2026-01-31'", "date('2026-01-31')"],
        ['null', 'null'],
        ['true', 'true'],
        // names
        ['status', 'status'],
        ['o.status', 'o.status'],
        // arithmetic and text
        ['a + b * c', '(a + (b * c))'],
        ['a * b + c', '((a * b) + c)'],
        ['a - b - c', '((a - b) - c)'],
        ['a / b / c', '((a / b) / c)'],
        ['-a * b', '((-a) * b)'],
        ['(a + b) * c', '(paren((a + b)) * c)'],
        ["name || ' (old)'", "(name || ' (old)')"],
        // comparisons
        ['a = 1', '(a = 1)'],
        ['a <> 1', '(a <> 1)'],
        ['a < b + 1', '(a < (b + 1))'],
        ['a <= 1', '(a <= 1)'],
        ['a > 1', '(a > 1)'],
        ['a >= 1', '(a >= 1)'],
        // logic
        ['a = 1 or b = 2 and c = 3', '((a = 1) or ((b = 2) and (c = 3)))'],
        ['not a = 1 and b = 2', '((not (a = 1)) and (b = 2))'],
        ['not not a = 1', '(not (not (a = 1)))'],
        // predicates
        ['a is null', '(a is null)'],
        ['a is not null', '(a is not null)'],
        ["a in ('x', 'y')", "(a in ('x', 'y'))"],
        ['a not in (1)', '(a not in (1))'],
        ['a in (select id from t)', '(a in (<select id from t>))'],
        ['a between 1 and 5 and b', '((a between 1 and 5) and b)'],
        ['a not between 1 and 5', '(a not between 1 and 5)'],
        ["a like 'x%'", "(a like 'x%')"],
        ["a not like 'x%'", "(a not like 'x%')"],
        // case and cast
        ["case when stock = 0 then 'OUT' else 'OK' end", "case(when (stock = 0) then 'OUT'; else 'OK')"],
        ["case status when 'A' then 1 when 'B' then 2 end", "case(status; when 'A' then 1; when 'B' then 2)"],
        ['cast(created_at as date) + days(3)', '(cast(created_at as date) + days(3))'],
        ['cast(x as varchar(20))', 'cast(x as varchar(20))'],
        // functions
        ['upper(trim(o.status))', 'upper(trim(o.status))'],
        ['coalesce(payment_terms, 30)', 'coalesce(payment_terms, 30)'],
        ['count(*)', 'count(*)'],
        ['length(a)', 'length(a)'],
        // subqueries
        ['(select max(id) from order_status)', '<select max(id) from order_status>'],
        ["(select s.id from order_status s where s.code = 'X')", "<select s.id from order_status s where (s.code = 'X')>"],
        ['exists (select 1 from orders o where o.id = 1)', 'exists(<select 1 from orders o where (o.id = 1)>)'],
        ['not exists (select 1 from orders)', '(not exists(<select 1 from orders>))'],
        // M1-AC-18
        ['next value for bookshop_seq', 'next(bookshop_seq)'],
    ])('%s', async (text, grouped) => {
        expect(await expression(text)).toBe(grouped);
    });

    // M1-AC-17
    test('keywords are not case-sensitive', async () => {
        expect(await expression("CASE WHEN a IS NOT NULL AND b In (1) THEN Cast(a AS Date) ELSE NULL END"))
            .toBe('case(when ((a is not null) and (b in (1))) then cast(a as Date); else null)');
    });

    test('words that are keywords elsewhere may name a column', async () => {
        expect(await expression('value + key + date + type + data + next')).toBe('(((((value + key) + date) + type) + data) + next)');
    });
});
