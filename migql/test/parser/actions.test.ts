import { describe, expect, test } from 'vitest';
import { ACTIONS } from '../../src/actions/catalogue.js';
import { isActionEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, error, lines } from '../support.js';

const { parse, parseMarked, tokens } = createMigql();

const NAME = 'migration: 20260302-0900-x';

function part(...body: string[]): string {
    return lines(NAME, 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

// M3.2-AC-06
describe('Actions: a part takes an action in the place of do', () => {
    test('the catalogue has the five first actions', () => {
        expect(ACTIONS.map(action => action.name)).toEqual([
            'column-ensure', 'column-rename', 'column-set-not-null', 'constraint-add-check', 'constraint-add-foreign-key',
        ]);
    });

    test.each([
        ['column-set-not-null: { table: customer, column: loyalty_level }'],
        ['column-rename: { table: customer, from: mail, to: email }'],
        ['column-ensure: { table: orders, column: note, type: varchar(500) }'],
        ['constraint-add-foreign-key: { name: fk_review_book, table: review, columns: book_id, references: book }'],
        ['constraint-add-check: { name: ck_book_price, table: book, check: stock }'],
    ])('%s', async body => {
        const parsed = await parseMarked(part(body));

        expect(parsed).toHaveNoIssues();
        const entries = partsOf(parsed.document.parseResult.value as never)[0].entries;
        expect(entries.filter(isActionEntry).map(entry => entry.action)).toEqual([body.split(' ')[0]]);
    });

    test('an action and a do in one part is an error', async () => {
        const parsed = await parseMarked(part('column-rename: { table: customer, from: mail, to: email }', 'do: delete from t').replace('- p:', '- <<{|p|}>>:'));

        expect(parsed).toHaveDocumentIssues([
            error('The part "p" has 2 operations: column-rename, do. A part holds exactly one. Move the others into parts of their own.', 0),
        ]);
    });

    test('two actions in one part is an error', async () => {
        const parsed = await parseMarked(part(
            'column-rename: { table: customer, from: mail, to: email }', 'column-set-not-null: { table: customer, column: email }',
        ).replace('- p:', '- <<{|p|}>>:'));

        expect(parsed).toHaveDocumentIssues([
            error('The part "p" has 2 operations: column-rename, column-set-not-null. A part holds exactly one. Move the others into parts of their own.', 0),
        ]);
    });
});

// M3.2-AC-07
describe('Actions: one line or a block', () => {
    test('a flow map gives the keys as names, also keys that are keywords or have a dash', () => {
        expect(tokens(part('column-ensure: { table: orders, column: note, type: varchar(500), not-null: true, default: 0 }')).slice(9, -2)).toEqual([
            'column-ensure:', '{', 'NAME(table)', ':', 'ID(orders)', ',', 'NAME(column)', ':', 'ID(note)', ',',
            'NAME(type)', ':', 'ID(varchar)', '(', 'INT(500)', ')', ',', 'NAME(not-null)', ':', 'true', ',', 'NAME(default)', ':', 'INT(0)', '}', 'EOL()',
        ]);
    });

    test('the block form has one parameter per line', async () => {
        const parsed = await parseMarked(part(
            'constraint-add-foreign-key:', '  name: fk_price_book', '  table: book_price', '  columns: [book_id, currency]',
            '  references: book_edition', '  referenced-columns: [book_id, currency]',
        ));

        expect(parsed).toHaveNoIssues();
    });

    test('a check may stand in a literal block', async () => {
        const parsed = await parseMarked(part(
            'constraint-add-check:', '  name: ck_book_price', '  table: book', '  check: |', '    price_cents >= 0', "      and (stock > 0 or title <> '')",
        ));

        expect(parsed).toHaveNoIssues();
    });
});

// M3.2-AC-08
describe('Actions: parameters', () => {
    test('a missing mandatory parameter is an error at the action', async () => {
        const parsed = await parseMarked(part('<<{|column-rename|}>>: { table: customer, from: mail }'));

        expect(parsed).toHaveDocumentIssues([
            error('The action "column-rename" needs the parameter "to". Its parameters: table, from, to.', 0),
        ]);
    });

    test('an action without any parameter names all that are missing', async () => {
        const parsed = await parseMarked(part('<<{|column-set-not-null|}>>: {}'));

        expect(parsed).toHaveDocumentIssues([
            error('The action "column-set-not-null" needs the parameters "table" and "column". Its parameters: table, column.', 0),
        ]);
    });

    test('an unknown parameter is an error at the parameter', async () => {
        const parsed = await parseMarked(part('column-rename: { table: customer, from: mail, to: email, <<{|keep|}>>: true }'));

        expect(parsed).toHaveDocumentIssues([
            error('The action "column-rename" has no parameter "keep". Its parameters: table, from, to.', 0),
        ]);
    });

    test('a parameter that is given twice is an error at the second place', async () => {
        const parsed = await parseMarked(part('column-rename:', '  table: customer', '  from: mail', '  to: email', '  <<{|from|}>>: e_mail'));

        expect(parsed).toHaveDocumentIssues([
            error('The parameter "from" of "column-rename" is given twice. Its parameters: table, from, to.', 0),
        ]);
    });

    test('optional parameters are listed in brackets', async () => {
        const parsed = await parseMarked(part('<<{|column-ensure|}>>: { table: orders, column: note }'));

        expect(parsed).toHaveDocumentIssues([
            error('The action "column-ensure" needs the parameter "type". Its parameters: table, column, type, [default], [not-null].', 0),
        ]);
    });

    test.each([
        ['column-rename: { table: <<{|1|}>>, from: mail, to: email }', 'The parameter "table" of "column-rename" takes a name.'],
        ['column-rename: { table: customer, from: <<{|a.b|}>>, to: email }', 'The parameter "from" of "column-rename" takes a name.'],
        ["column-ensure: { table: orders, column: note, type: <<{|'text'|}>> }", 'The parameter "type" of "column-ensure" takes a type, such as varchar(200).'],
        ['column-ensure: { table: orders, column: note, type: date, not-null: <<{|yes|}>> }', 'The parameter "not-null" of "column-ensure" takes true or false.'],
        ['constraint-add-foreign-key: { name: fk, table: review, columns: <<{|1|}>>, references: book }',
            'The parameter "columns" of "constraint-add-foreign-key" takes a name, or a list of names in square brackets.'],
    ])('%s', async (body, message) => {
        expect(await parseMarked(part(body))).toHaveDocumentIssues([error(message, 0)]);
    });
});

// M3.2-AC-09
describe('Actions: what needs the block form', () => {
    const BLOCK = ' In a flow map { … } a value is a literal, a name or a type without a comma. Write the action as a block, with one parameter per line.';

    test.each([
        ['constraint-add-foreign-key: { name: fk, table: t, columns: <<{|[a, b]|}>>, references: u }'],
        ['constraint-add-check: { name: ck, table: book, check: <<{|price_cents >= 0|}>> }'],
        ['column-ensure: { table: book, column: weight, type: <<{|numeric(10, 2)|}>> }'],
        ['column-ensure: { table: book, column: weight, type: integer, default: <<{|1 + 1|}>> }'],
    ])('%s', async body => {
        expect(await parseMarked(part(body))).toHaveDocumentIssues([error('This value needs the block form.' + BLOCK, 0)]);
    });

    test('the same values are accepted in the block form', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:',
            '  - a:', '      constraint-add-foreign-key:', '        name: fk', '        table: t', '        columns: [a, b]', '        references: u',
            '  - b:', '      column-ensure:', '        table: book', '        column: weight', '        type: numeric(10, 2)', '        default: 1 + 1',
        ));

        expect(parsed).toHaveNoIssues();
    });

    test('a list of names is a value of a parameter for columns only', async () => {
        const parsed = await parseMarked(part('column-rename:', '  table: <<{|[a, b]|}>>', '  from: mail', '  to: email'));

        expect(parsed).toHaveDocumentIssues([error('The parameter "table" of "column-rename" takes a name.', 0)]);
    });
});

// M3.2-AC-11
describe('Actions: the other keys of a part', () => {
    test('work with an action as with do', async () => {
        const parsed = await parseMarked(part(
            'when: column customer.mail exists', 'verify-before: true', 'column-rename: { table: customer, from: mail, to: email }',
            'verify-after:', '  - all: customer.email is not null', 'phase: finish',
        ));

        expect(parsed).toHaveNoIssues();
    });
});

// M3.2-AC-12
describe('Actions: names in parameters', () => {
    test('are exact, and a name with other characters is written in quotes', async () => {
        const document = await parse(part('column-rename: { table: "Order Item", from: Key, to: "Line No" }'));

        expect(document).toHaveNoErrors();
    });
});

// M3.2-AC-03
describe('Statements that became actions', () => {
    test('ensure column under do is an error that names the action', async () => {
        const parsed = await parseMarked(part('do: <<{|ensure|}>> column orders.note varchar(500)'));

        expect(parsed).toHaveDocumentIssues([
            error('"ensure column" is not a statement any more. Use the action in the place of do: column-ensure: { table: orders, column: note, type: varchar(500) }', 0),
        ]);
    });

    test('rename column table.old to new under do is an error that names the action', async () => {
        const parsed = await parseMarked(part('do: <<{|rename|}>> column customer.mail to email'));

        expect(parsed).toHaveDocumentIssues([
            error('"rename column" is not a statement any more. Use the action in the place of do: column-rename: { table: customer, from: mail, to: email }', 0),
        ]);
    });

    // M3.2-AC-02
    test('the rename of SQL is a statement', async () => {
        expect(await parseMarked(part('do: alter table customer rename column mail to email'))).toHaveNoErrors();
    });
});
