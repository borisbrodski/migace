import { describe, expect, test } from 'vitest';
import { runScript, ScriptFailed } from '../src/index.js';

/** A fake connection: records what is sent, and answers as the test says. */
function connection(answers: Record<string, unknown> = {}) {
    const sent: string[] = [];
    const execute = async (sql: string, onNotice: (message: string) => void) => {
        sent.push(sql);
        const answer = answers[sql];
        if (answer instanceof Error) {
            throw answer;
        }
        if (typeof answer === 'string') {
            onNotice(answer);
            return [];
        }
        return answer === undefined ? [] : [{ run: answer }];
    };
    return { sent, execute };
}

const script = (...lines: string[]) => ['-- @migace script format=1', ...lines].join('\n') + '\n';

// M4.1-AC-11
describe('The reference runner', () => {
    test('sends one statement at a time, in the order of the script', async () => {
        const { sent, execute } = connection();

        await runScript(script('-- @migace statement', 'select 1', '-- @migace statement', 'select', '  2', '', '-- @migace statement', 'select 3'), execute);

        expect(sent).toEqual(['select 1', 'select\n  2', 'select 3']);
    });

    test('runs a guarded statement only if its guard query returns true', async () => {
        const { sent, execute } = connection({ 'select yes()': true, 'select no()': false });

        await runScript(script(
            '-- @migace guard', 'select yes()', '-- @migace statement outside-transaction', 'create index concurrently a on t (c)',
            '-- @migace guard', 'select no()', '-- @migace statement outside-transaction', 'create index concurrently b on t (c)',
            '-- @migace statement', 'select 3',
        ), execute);

        expect(sent).toEqual(['select yes()', 'create index concurrently a on t (c)', 'select no()', 'select 3']);
    });

    test('stops at the first error and sends nothing after it', async () => {
        const { sent, execute } = connection({ 'select 2': new Error('division by zero') });

        await expect(runScript(script('-- @migace statement', 'select 1', '-- @migace statement', 'select 2', '-- @migace statement', 'select 3'), execute))
            .rejects.toThrow(ScriptFailed);

        expect(sent).toEqual(['select 1', 'select 2']);
    });

    // M4.1-AC-12
    test('the error carries the message of the database, and the label of the statement if it has one', async () => {
        const { execute } = connection({ 'select 1': new Error('20260302-0900-a, part p: division by zero'), 'create index concurrently a on t (c)': new Error('could not create unique index "a"') });

        await expect(runScript(script('-- @migace statement', 'select 1'), execute)).rejects.toThrow('20260302-0900-a, part p: division by zero');
        await expect(runScript(script('-- @migace statement outside-transaction label="20260302-0900-b, part index"', 'create index concurrently a on t (c)'), execute))
            .rejects.toThrow('20260302-0900-b, part index: could not create unique index "a"');
    });

    test('passes the notices of the server to the caller', async () => {
        const { execute } = connection({ 'select 1': 'first notice', 'select 2': 'second notice' });
        const notices: string[] = [];

        await runScript(script('-- @migace statement', 'select 1', '-- @migace statement', 'select 2'), execute, { onNotice: notice => notices.push(notice) });

        expect(notices).toEqual(['first notice', 'second notice']);
    });

    // M4.1-AC-39
    test('sends the parameters of the run as session settings before the first statement', async () => {
        const { sent, execute } = connection();

        await runScript(script('-- @migace statement', 'select 1'), execute, { parameters: { schema: 'book shop', note: "it's" } });

        expect(sent).toEqual([
            "select set_config('migace.schema', 'book shop', false)",
            "select set_config('migace.note', 'it''s', false)",
            "select set_config('migace.parameters', 'schema,note', false)",
            'select 1',
        ]);
    });

    test('a parameter with a name that is no plain word is refused', async () => {
        const { execute } = connection();

        await expect(runScript(script(), execute, { parameters: { "x', 'y": '1' } })).rejects.toThrow('The name of a parameter is made of letters, digits and underscores');
    });

    // M4.1-AC-08
    test('refuses a script of a format it does not know, and a text that is no script', async () => {
        const { sent, execute } = connection();

        await expect(runScript('-- @migace script format=2\n-- @migace statement\nselect 1\n', execute))
            .rejects.toThrow('This runner reads the script format 1. The script has the format 2.');
        await expect(runScript('select 1\n', execute)).rejects.toThrow('This is no migration script: its first line is not "-- @migace script format=…".');
        expect(sent).toEqual([]);
    });

    test('text before the first marker and an unknown marker are errors, and nothing is sent', async () => {
        const { sent, execute } = connection();

        await expect(runScript(script('select 0', '-- @migace statement', 'select 1'), execute)).rejects.toThrow('Line 2: text outside a statement.');
        await expect(runScript(script('-- @migace surprise', 'select 1'), execute)).rejects.toThrow('Line 2: unknown marker "surprise".');
        await expect(runScript(script('-- @migace guard', 'select true', '-- @migace guard', 'select true'), execute)).rejects.toThrow('Line 2: this guard is not followed by a statement.');
        expect(sent).toEqual([]);
    });

    test('it knows nothing about the ledger, snippets or parts', async () => {
        const source = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/runner.ts', import.meta.url), 'utf8'));

        expect(source).not.toMatch(/ledger|snippet|\bpart\b/i);
    });
});
