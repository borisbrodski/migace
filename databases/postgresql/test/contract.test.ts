import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, test } from 'vitest';
import { runScript, ScriptFailed, ScriptRefused } from '../src/index.js';

const CONTRACT = fileURLToPath(new URL('../../../clients/contract', import.meta.url));

interface Case {
    description: string;
    script: string;
    parameters?: Record<string, string>;
    answers?: Array<{ rows?: unknown[][], notices?: string[], error?: { code: string, message: string } }>;
    expected: { outcome: 'success' | 'failure' | 'refused', sent: string[], notices?: string[], error?: { message?: string, code?: string, mentions?: string[] } };
}

const cases = fs.readdirSync(path.join(CONTRACT, 'cases')).filter(file => file.endsWith('.json')).sort()
    .map(file => ({ file, ...JSON.parse(fs.readFileSync(path.join(CONTRACT, 'cases', file), 'utf8')) as Case }));

/** Runs a case against a database that answers as the case says. Returns what a runner is judged by. */
async function play(given: Case) {
    const sent: string[] = [];
    const notices: string[] = [];
    let outcome = 'success';
    let error: { message: string, code?: string } | undefined;
    try {
        await runScript(given.script, async (sql, onNotice) => {
            const answer = given.answers?.[sent.length] ?? {};
            sent.push(sql);
            answer.notices?.forEach(onNotice);
            if (answer.error) {
                throw Object.assign(new Error(answer.error.message), { code: answer.error.code });
            }
            return (answer.rows ?? []).map(row => Object.fromEntries(row.map((value, index) => [`column${index}`, value])));
        }, { parameters: given.parameters, onNotice: notice => notices.push(notice) });
    } catch (thrown) {
        outcome = thrown instanceof ScriptRefused ? 'refused' : thrown instanceof ScriptFailed ? 'failure' : 'unexpected error';
        error = { message: (thrown as Error).message, code: (thrown as ScriptFailed).code };
    }
    return { sent, notices, outcome, error };
}

// M4.3-AC-02
describe('The cases of the client contract', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(CONTRACT, 'case.schema.json'), 'utf8'));
    const valid = new Ajv2020({ allErrors: true }).compile(schema);

    test('there are cases', () => {
        expect(cases.length).toBeGreaterThanOrEqual(20);
    });

    test.each(cases)('$file follows the schema of a case', given => {
        const { file, ...content } = given;
        valid(content);

        expect(valid.errors ?? [], file).toEqual([]);
    });

    test('the README describes every key of a case and every marker', () => {
        const readme = fs.readFileSync(path.join(CONTRACT, 'README.md'), 'utf8');

        for (const word of ['script', 'parameters', 'answers', 'rows', 'notices', 'error', 'expected', 'outcome', 'sent', 'mentions',
            '-- @migace script format=1', '-- @migace statement', '-- @migace guard', '-- @migace finally', 'outside-transaction', 'label=']) {
            expect(readme, word).toContain(word);
        }
    });
});

// M4.3-AC-05
describe('The reference runner passes the client contract', () => {
    test.each(cases)('$file: $description', async given => {
        const played = await play(given);

        expect(played.outcome).toBe(given.expected.outcome);
        expect(played.sent).toEqual(given.expected.sent);
        expect(played.notices).toEqual(given.expected.notices ?? []);
        if (given.expected.error?.message !== undefined) {
            expect(played.error?.message).toBe(given.expected.error.message);
        }
        if (given.expected.error?.code !== undefined) {
            expect(played.error?.code).toBe(given.expected.error.code);
        }
        for (const text of given.expected.error?.mentions ?? []) {
            expect(played.error?.message).toContain(text);
        }
    });
});
