import type { GeneratorManager } from 'langium-tools/generator';
import type { ColumnValue, InsertEntry, Part, Snippet } from '../../src/generated/ast.js';
import { isDoEntry, isInsertEntry, isIntoEntry, isNativeEntry, isRowsEntry, isValuesEntry } from '../../src/generated/ast.js';
import { nameEntry, partsOf } from '../../src/model/snippet.js';
import { expression } from './expressions.js';
import { NotGeneratedYet, statement } from './statements.js';

export { NotGeneratedYet };

const DIALECT = 'postgresql';

/**
 * Writes the PostgreSQL statements of a snippet into one file, part by part.
 *
 * This is the translation only. The script that runs the parts, with ledger and conditions,
 * is built from it in a later milestone.
 */
export function generateSnippet(snippet: Snippet, output: GeneratorManager): void {
    const name = nameEntry(snippet)?.name ?? 'snippet';
    const parts = partsOf(snippet).map(part => `-- part: ${part.name}\n${partOrNote(part)}\n`);
    output.createFile(`${DIALECT}/${name}.sql`, [`-- ${name}\n`, ...parts].join('\n'));
}

function partOrNote(part: Part): string {
    try {
        return generatePart(part);
    } catch (error) {
        if (error instanceof NotGeneratedYet) {
            return `-- not generated yet: ${error.message}`;
        }
        throw error;
    }
}

/**
 * The PostgreSQL text of the operation of one part.
 *
 * A generator translates. It never adds syntax, and the same part always gives the same text.
 */
export function generatePart(part: Part): string {
    for (const entry of part.entries) {
        if (isDoEntry(entry)) {
            return statement(entry.statement) + ';';
        }
        if (isInsertEntry(entry)) {
            return insert(entry) + ';';
        }
        if (isNativeEntry(entry)) {
            const variant = entry.variants.find(candidate => candidate.dialect === DIALECT);
            if (variant) {
                return variant.sql.trimEnd() + ';';
            }
        }
    }
    throw new Error(`The part "${part.name}" has no operation for PostgreSQL.`);
}

/** An insert in YAML form is the same operation as `insert into … values …`. */
function insert(entry: InsertEntry): string {
    const table = entry.entries.find(isIntoEntry)?.table;
    const rows: ColumnValue[][] = [
        ...entry.entries.filter(isValuesEntry).map(values => values.values),
        ...entry.entries.filter(isRowsEntry).flatMap(list => list.rows.map(row => row.map.values)),
    ];
    const columns = rows[0].map(value => value.column);
    const tuples = rows.map(row => `(${row.map(value => expression(value.value)).join(', ')})`);
    const head = `insert into ${table} (${columns.join(', ')}) values`;
    return tuples.length === 1 ? `${head} ${tuples[0]}` : `${head}\n${tuples.map(tuple => '    ' + tuple).join(',\n')}`;
}
