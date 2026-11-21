import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';
import { websiteExamples } from './website-examples.js';

const { parse } = createMigql();

/**
 * Examples that show syntax the vault does not define. They are skipped until the open
 * question is answered. The text is a piece of the example, the reason names the question.
 */
const UNDEFINED_SYNTAX: Array<{ contains: string, reason: string }> = [
    { contains: 'expand column customer.mail to email', reason: 'open question 24: the vault defines "rename column", the website "expand column"' },
    { contains: 'contract column customer.mail', reason: 'open question 24: the vault defines "rename column", the website "contract column"' },
];

const examples = websiteExamples();
const snippets = examples.filter(example => example.kind !== 'settings');

// M1-AC-29
describe('Examples of the website', () => {
    test('the website shows complete snippets, fragments with parts, fragments with keys, and settings', () => {
        const count = (kind: string) => examples.filter(example => example.kind === kind).length;

        expect({ snippet: count('snippet'), parts: count('parts'), keys: count('keys'), settings: count('settings') })
            .toEqual({ snippet: 18, parts: 33, keys: 14, settings: 11 });
    });

    for (const example of snippets) {
        const skipped = UNDEFINED_SYNTAX.find(entry => example.text.includes(entry.contains));
        if (skipped) {
            test.skip(`${example.title} (${skipped.reason})`, () => undefined);
            continue;
        }
        test(`${example.title} parses`, async () => {
            const document = await parse(example.text);

            expect(document).toHaveNoErrors();
        });
    }
});
