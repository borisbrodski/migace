import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AstUtils, GrammarAST } from 'langium';
import { describe, expect, test } from 'vitest';
import { isDoEntry, isUpdate } from '../../src/generated/ast.js';
import { exactName, sameName } from '../../src/model/names.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql, error, lines, partWhen } from '../support.js';

const { services, parse, parseMarked } = createMigql();

const NAME = 'migration: 20260302-0900-x';

function part(...body: string[]): string {
    return lines(NAME, 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

// M3.1-AC-01
describe('Names: the rule', () => {
    test('two written names are the same name when their characters are the same without the quotes', () => {
        expect(sameName('Key', '"Key"')).toBe(true);
        expect(sameName('"Line Item"', '"Line Item"')).toBe(true);
        expect(sameName('key', 'Key')).toBe(false);
        expect(sameName('key', '"KEY"')).toBe(false);
        expect(exactName('"Key"')).toBe('Key');
        expect(exactName('Key')).toBe('Key');
    });

    test('the syntax tree holds the exact name, whether it was written in quotes or not', async () => {
        const document = await parse(part('do: |', '  update "Order" O set "Line Item" = 1, Total = "O".total'));

        const statement = partsOf(document.parseResult.value)[0].entries.filter(isDoEntry)[0].statement;
        expect(isUpdate(statement) && [statement.table, statement.alias, ...statement.assignments.map(each => each.column)])
            .toEqual(['Order', 'O', 'Line Item', 'Total']);
        expect(isUpdate(statement) && statement.assignments[1].value).toMatchObject({ table: 'O', column: 'total' });
    });
});

// M3.1-AC-02
describe('Names: checks follow the rule', () => {
    const upsert = (key: string, column: string) => part('upsert:', '  into: order_status', `  key: ${key}`, '  rows:', `    - <<{|{ ${column}: 'OPEN' }|}>>`);

    test('a key column in another case is another column', async () => {
        expect(await parseMarked(upsert('Code', 'code'))).toHaveDocumentIssues([
            error('This row has no value for the key column "Code". Every row of an upsert gives all key columns.', 0),
        ]);
    });

    test('a key column in quotes is the same column as without', async () => {
        expect(await parseMarked(upsert('"Code"', 'Code').replace(/<<\{\||\|\}>>/g, ''))).toHaveNoIssues();
    });
});

// M3.1-AC-03
describe('Names: names of conditions', () => {
    test('a name in another case is not the definition', async () => {
        const parsed = await parseMarked(lines(NAME, 'let:', '  buggy: true', ...partWhen('<<{|Buggy|}>>')));

        expect(parsed).toHaveDocumentIssues([
            error('Unknown condition "Buggy". Define it under "let", or check the spelling. Defined here: buggy.', 0),
        ]);
    });

    test('a name in quotes is the same name', async () => {
        expect(await parseMarked(lines(NAME, 'let:', '  buggy: true', ...partWhen('"buggy"')))).toHaveNoIssues();
    });
});

// M3.1-AC-06
describe('Names: what is not supported', () => {
    test('an empty name is an error', async () => {
        expect(await parseMarked(part('do: |', '  update <<{|""|}>> set a = 1'))).toHaveDocumentIssues([
            error('A name cannot be empty. Write the name between the double quotes.', 0),
        ]);
    });

    test('a double quote inside a name is an error', async () => {
        expect(await parseMarked(part('do: |', '  update t set <<{|"a""b"|}>> = 1'))).toHaveDocumentIssues([
            error('A double quote inside a name is not supported. Choose a name without it.', 0),
        ]);
    });
});

/** The words of the language, read from the grammar: all keywords of the statement language, and those that the rule Name accepts. */
function keywords(): { all: string[], names: string[] } {
    const grammar = services.migql.Grammar;
    const isWord = (keyword: GrammarAST.Keyword) => /^[a-z]+$/.test(keyword.value);
    const all = AstUtils.streamAllContents(grammar).filter(GrammarAST.isKeyword).filter(isWord).map(keyword => keyword.value).toArray();
    const nameRule = grammar.rules.find(rule => rule.name === 'Name')!;
    const names = AstUtils.streamAllContents(nameRule).filter(GrammarAST.isKeyword).map(keyword => keyword.value).toArray();
    return { all: [...new Set(all)].sort(), names: names.sort() };
}

// M3.1-AC-26
describe('Names: keywords that may be a name without quotes', () => {
    const KEYWORDS_NOTE = fileURLToPath(new URL('../../../MIG-Ace-vault/migql/keywords.md', import.meta.url));

    test('the list in the vault is the list of the grammar', () => {
        const rows = [...fs.readFileSync(KEYWORDS_NOTE, 'utf8').matchAll(/^\| `([a-z]+)` \| (yes|no) \|/gm)];
        const listed = rows.map(row => row[1]).sort();
        const listedAsName = rows.filter(row => row[2] === 'yes').map(row => row[1]).sort();

        expect(listed).toEqual(keywords().all);
        expect(listedAsName).toEqual(keywords().names);
    });

    test.each(keywords().names)('%s names a table and a column in a statement', async keyword => {
        const parsed = await parseMarked(part(
            'do: |', `  update ${keyword} set ${keyword} = ${keyword} + 1 where ${keyword} is not null and ${keyword}.${keyword} = (select ${keyword} from ${keyword})`,
        ));

        expect(parsed).toHaveNoIssues();
        const statement = partsOf(parsed.document.parseResult.value as never)[0].entries.filter(isDoEntry)[0].statement;
        expect(statement).toMatchObject({ table: keyword, assignments: [{ column: keyword }] });
    });

    test.each(keywords().names)('%s names a table and a column in a condition', async keyword => {
        const parsed = await parseMarked(lines(
            NAME, ...partWhen(`column ${keyword}.${keyword} exists and table ${keyword} exists and exists (select ${keyword} from ${keyword} where ${keyword} = 1)`),
        ));

        expect(parsed).toHaveNoIssues();
    });

    // M3.1-AC-05
    test.each(keywords().all.filter(keyword => !keywords().names.includes(keyword)))('%s needs quotes to be a name', async keyword => {
        const parsed = await parseMarked(part('do: |', `  drop table <<{|${keyword}|}>>`));

        expect(parsed).toHaveDocumentIssues([
            error(`Expected a name, but found "${keyword}". "${keyword}" is a keyword. To use it as a name, write it in double quotes: "${keyword}".`, 0),
        ]);
    });

    test('a keyword in quotes is a name everywhere', async () => {
        const parsed = await parseMarked(part('do: |', '  update "select" "from" set "where" = "from"."and" where "not" is null'));

        expect(parsed).toHaveNoIssues();
    });
});
