import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';
import { websiteExamples } from './website-examples.js';

const { services } = createMigql();
const parser = services.migql.parser.LangiumParser;

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

const validFiles = [
    ...fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct => {
        const folder = path.join(CATALOGUE, construct.name, 'dsls');
        return fs.readdirSync(folder).map(file => fs.readFileSync(path.join(folder, file), 'utf8'));
    }),
    ...websiteExamples().filter(example => example.kind === 'snippet').map(example => example.text),
];

/** Characters that mean something to YAML or to the statement language, and a few that mean nothing. */
const CHARACTERS = [' ', '\t', '\n', ':', '-', '#', '|', '>', "'", '"', '{', '}', '(', ')', ',', '.', '=', '?', '&', '*', '!', 'a', '1', '~', 'é', '\u0000'];

type Change = (text: string) => string;

const change: fc.Arbitrary<Change> = fc.oneof(
    fc.tuple(fc.nat(), fc.constantFrom(...CHARACTERS)).map(([at, character]): Change => text => {
        const offset = at % (text.length + 1);
        return text.slice(0, offset) + character + text.slice(offset);
    }),
    fc.tuple(fc.nat(), fc.integer({ min: 1, max: 12 })).map(([at, length]): Change => text => {
        const offset = at % (text.length + 1);
        return text.slice(0, offset) + text.slice(offset + length);
    }),
    fc.tuple(fc.nat(), fc.nat()).map(([from, to]): Change => text => {
        const lines = text.split('\n');
        const [line] = lines.splice(from % lines.length, 1);
        lines.splice(to % (lines.length + 1), 0, line);
        return lines.join('\n');
    }),
    fc.tuple(fc.nat(), fc.integer({ min: -4, max: 4 })).map(([at, shift]): Change => text => {
        const lines = text.split('\n');
        const index = at % lines.length;
        lines[index] = shift >= 0 ? ' '.repeat(shift) + lines[index] : lines[index].slice(Math.min(-shift, lines[index].length - lines[index].trimStart().length));
        return lines.join('\n');
    }),
);

// M1-AC-31
describe('Random changes to valid snippets', () => {
    test('the parser neither crashes nor hangs, and every problem has a position', () => {
        fc.assert(fc.property(fc.constantFrom(...validFiles), fc.array(change, { minLength: 1, maxLength: 5 }), (file, changes) => {
            const text = changes.reduce((current, apply) => apply(current), file);

            const result = parser.parse(text);

            for (const error of result.lexerErrors) {
                expect(error.offset).toBeGreaterThanOrEqual(0);
                expect(error.line).toBeGreaterThanOrEqual(1);
                expect(error.column).toBeGreaterThanOrEqual(1);
                expect(error.message.length).toBeGreaterThan(0);
            }
            for (const error of result.parserErrors) {
                expect(error.message.length).toBeGreaterThan(0);
                expect(Number.isNaN(error.token.startOffset) ? error.token.tokenType.name : 'placed').toMatch(/^(placed|EOF)$/);
            }
        }), { seed: 20261121, numRuns: 1000 });
    }, 60_000);
});
