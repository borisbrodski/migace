import type { GeneratorManager } from 'langium-tools/generator';
import type { ColumnValue, InsertEntry, Part, Snippet, UpsertEntry } from '../../src/generated/ast.js';
import { isDoEntry, isInsertEntry, isIntoEntry, isKeyEntry, isNativeEntry, isRowsEntry, isUpsertEntry, isValuesEntry } from '../../src/generated/ast.js';
import { nameEntry, partsOf } from '../../src/model/snippet.js';
import { expression } from './expressions.js';
import { name } from './names.js';
import { NotGeneratedYet, statement, type Step } from './statements.js';

export { NotGeneratedYet, type Step };

const DIALECT = 'postgresql';

/**
 * Writes the PostgreSQL statements of a snippet into one file, part by part.
 *
 * This is the translation only. The script that runs the parts, with ledger and conditions,
 * is built from it in a later milestone.
 */
export function generateSnippet(snippet: Snippet, output: GeneratorManager): void {
    const snippetName = nameEntry(snippet)?.name ?? 'snippet';
    const parts = partsOf(snippet).map(part => `-- part: ${part.name}\n${generatePart(part)}\n`);
    output.createFile(`${DIALECT}/${snippetName}.sql`, [`-- ${snippetName}\n`, ...parts].join('\n'));
}

/**
 * The PostgreSQL text of one part, as it stands in the expected files: every statement ends
 * with a semicolon, and comment lines say what the script has to know about a statement.
 */
export function generatePart(part: Part): string {
    const steps = generateSteps(part);
    return steps.flatMap((step, index) => [
        ...(steps.length > 1 ? [`-- step ${index + 1} of ${steps.length}`] : []),
        ...(step.outsideTransaction ? ['-- outside transaction'] : []),
        `${step.sql};`,
    ]).join('\n');
}

/**
 * The PostgreSQL statements of the operation of one part.
 *
 * A generator translates. It never adds syntax, and the same part always gives the same statements.
 */
export function generateSteps(part: Part): Step[] {
    for (const entry of part.entries) {
        if (isDoEntry(entry)) {
            return statement(entry.statement);
        }
        if (isInsertEntry(entry)) {
            return [{ sql: insert(part, entry) }];
        }
        if (isUpsertEntry(entry)) {
            return [{ sql: upsert(part, entry) }];
        }
        if (isNativeEntry(entry)) {
            const variant = entry.variants.find(candidate => candidate.dialect === DIALECT);
            if (!variant) {
                const others = entry.variants.map(candidate => candidate.dialect).join(', ');
                throw new Error(`The part "${part.name}" has native SQL for ${others}, but none for ${DIALECT}.`);
            }
            return [{ sql: variant.sql.trimEnd().replace(/;$/, '') }];
        }
    }
    throw new Error(`The part "${part.name}" has no operation for PostgreSQL.`);
}

/** An insert in YAML form is the same operation as `insert into … values …`. */
function insert(part: Part, entry: InsertEntry): string {
    const rows: ColumnValue[][] = [
        ...entry.entries.filter(isValuesEntry).map(values => values.values),
        ...entry.entries.filter(isRowsEntry).flatMap(list => list.rows.map(row => row.map.values)),
    ];
    return insertRows(part, entry.entries.find(isIntoEntry)!.table, rows);
}

/** Rows that are missing are inserted. Where a row with the same key exists, its other columns are updated. */
function upsert(part: Part, entry: UpsertEntry): string {
    const rows = entry.entries.filter(isRowsEntry).flatMap(list => list.rows.map(row => row.map.values));
    const key = entry.entries.filter(isKeyEntry).flatMap(keys => keys.columns).map(name);
    const others = rows[0].map(value => name(value.column)).filter(column => !key.includes(column));
    const onConflict = others.length > 0
        ? `do update set ${others.map(column => `${column} = excluded.${column}`).join(', ')}`
        : 'do nothing';
    return `${insertRows(part, entry.entries.find(isIntoEntry)!.table, rows)}\non conflict (${key.join(', ')}) ${onConflict}`;
}

function insertRows(part: Part, table: string, rows: ColumnValue[][]): string {
    const columns = rows[0].map(value => name(value.column));
    if (rows.some(row => row.map(value => name(value.column)).join() !== columns.join())) {
        throw new Error(`The rows of the part "${part.name}" have different columns. Every row of an upsert or an insert gives the same columns.`);
    }
    const tuples = rows.map(row => `(${row.map(value => expression(value.value)).join(', ')})`);
    const head = `insert into ${name(table)} (${columns.join(', ')}) values`;
    return tuples.length === 1 ? `${head} ${tuples[0]}` : `${head}\n${tuples.map(tuple => '    ' + tuple).join(',\n')}`;
}
