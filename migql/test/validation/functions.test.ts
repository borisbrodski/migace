import { describe, expect, test } from 'vitest';
import { FUNCTIONS } from '../../src/functions.js';
import { createMigql, error, lines } from '../support.js';

const { parseMarked } = createMigql();

function part(...body: string[]): string {
    return lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

// M3-AC-06, M3-AC-07
describe('Validation: functions', () => {
    test('the functions of the list are accepted, in any case', async () => {
        const calls = "upper(a), LOWER(a), trim(a), substring(a, 1, 3), length(a), coalesce(a, 'x'), days(3)";
        const parsed = await parseMarked(part(
            'do: |', `  insert into t (a, b, c, d, e, f, g) select ${calls} from u`,
            'when: (select count(*) from t) > 0 and (select max(id) from t) > (select min(id) + sum(n) from t)',
        ));

        expect(parsed).toHaveNoIssues();
    });

    test('a function that is not on the list is an error that names it and points to the list', async () => {
        const parsed = await parseMarked(part('do: update t set a = <<{|now|}>>(), b = upper(<<{|md5|}>>(c))'));

        const list = 'coalesce, count, days, length, lower, max, min, substring, sum, trim, upper';
        expect(parsed).toHaveDocumentIssues([
            error(`Unknown function "now". A snippet may call: ${list}. They are described in the MigQL notes, migql/functions.md. Anything else belongs in a native part.`, 0),
            error(`Unknown function "md5". A snippet may call: ${list}. They are described in the MigQL notes, migql/functions.md. Anything else belongs in a native part.`, 1),
        ]);
    });

    test('every function of the list has a description', () => {
        expect(Object.keys(FUNCTIONS).sort()).toEqual(['coalesce', 'count', 'days', 'length', 'lower', 'max', 'min', 'substring', 'sum', 'trim', 'upper']);
        expect(Object.values(FUNCTIONS).every(description => description.length > 10)).toBe(true);
    });
});
