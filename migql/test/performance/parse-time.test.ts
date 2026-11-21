import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';

const { services } = createMigql();
const parser = services.migql.parser.LangiumParser;
const lexer = services.migql.parser.Lexer;

/** A snippet of about 500 lines: 62 parts with a schema statement, a data statement in a block and checks. */
function largeSnippet(): string {
    const lines = ['migration: 20260101-0900-large', 'uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D', 'doc: A snippet of 500 lines', '', 'parts:'];
    for (let part = 0; lines.length < 500; part++) {
        lines.push(
            `  - add-column-${part}:`,
            `      do: alter table orders add column note_${part} varchar(500) not null default ''`,
            `  - fill-${part}:`,
            '      do: |',
            '        update orders o',
            `        set note_${part} = (select upper(trim(s.label)) from order_status s where s.id = o.status_id)`,
            `        where o.note_${part} is null and (o.total_cents > 100 * ${part} or o.status in ('OPEN', 'PAID'))`,
            '      batch: 20000 by id',
        );
    }
    return lines.join('\n') + '\n';
}

// M1-AC-33
describe('Time to parse', () => {
    test('a snippet of 500 lines is measured', () => {
        const text = largeSnippet();
        const measure = (run: () => void): number => {
            const times = Array.from({ length: 30 }, () => {
                const start = performance.now();
                run();
                return performance.now() - start;
            });
            return times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
        };
        parser.parse(text);

        const lexing = measure(() => lexer.tokenize(text));
        const parsing = measure(() => parser.parse(text));
        const result = parser.parse(text);

        expect(result.lexerErrors).toEqual([]);
        expect(result.parserErrors).toEqual([]);
        console.log(`500 lines, ${text.length} characters, ${lexer.tokenize(text).tokens.length} tokens: ` +
            `lexer ${lexing.toFixed(2)} ms, lexer and parser ${parsing.toFixed(2)} ms (median of 30 runs)`);
    });
});
