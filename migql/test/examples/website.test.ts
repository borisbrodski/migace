import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';
import { notBuiltYet, websiteExamples } from './website-examples.js';

const { parse } = createMigql();

const examples = websiteExamples();
const snippets = examples.filter(example => example.kind !== 'settings');

// M1-AC-29
describe('Examples of the website', () => {
    test('the website shows complete snippets, fragments with parts, fragments with keys, and settings', () => {
        const count = (kind: string) => examples.filter(example => example.kind === kind).length;

        expect({ snippet: count('snippet'), parts: count('parts'), keys: count('keys'), settings: count('settings') })
            .toEqual({ snippet: 18, parts: 43, keys: 14, settings: 11 });
    });

    for (const example of snippets) {
        const reason = notBuiltYet(example);
        if (reason) {
            test.skip(`${example.title} (${reason})`, () => undefined);
            continue;
        }
        test(`${example.title} parses`, async () => {
            const document = await parse(example.text);

            expect(document).toHaveNoErrors();
        });
    }
});
