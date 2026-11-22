/**
 * The reference runner: it sends a migration script to a database, one statement at a time.
 * All logic of a migration is in the script. A runner in another language does the same and no more.
 */

/** Runs one statement and returns its rows. Notices of the server go to `onNotice`. */
export type Execute = (sql: string, onNotice: (message: string) => void) => Promise<Array<Record<string, unknown>>>;

export interface RunOptions {
    /** Names and values that the script reads as session settings `migace.<name>`, for example the schema. */
    parameters?: Record<string, string>;
    onNotice?: (message: string) => void;
}

/** The script stopped at a statement that the database refused. */
export class ScriptFailed extends Error { }

const SCRIPT_FORMAT = 1;
const MARKER = /^-- @migace (\S+)(.*)$/;

interface Statement {
    sql: string;
    /** A query that says whether the statement runs. */
    guard?: string;
    /** Says what the statement belongs to, for the message of an error. */
    label?: string;
}

export async function runScript(script: string, execute: Execute, options: RunOptions = {}): Promise<void> {
    const statements = readScript(script);
    const onNotice = options.onNotice ?? (() => undefined);
    const send = async (statement: Statement, sql: string) => {
        try {
            return await execute(sql, onNotice);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ScriptFailed(statement.label ? `${statement.label}: ${message}` : message, { cause: error });
        }
    };
    for (const [name, value] of Object.entries(options.parameters ?? {})) {
        if (!/^\w+$/.test(name)) {
            throw new Error(`The name of a parameter is made of letters, digits and underscores: "${name}".`);
        }
        await send({ sql: '' }, `select set_config('migace.${name}', '${value.replace(/'/g, "''")}', false)`);
    }
    for (const statement of statements) {
        if (statement.guard !== undefined) {
            const [row] = await send(statement, statement.guard);
            if (!isTrue(row ? Object.values(row)[0] : undefined)) {
                continue;
            }
        }
        await send(statement, statement.sql);
    }
}

function isTrue(value: unknown): boolean {
    return value === true || value === 't' || value === 'true';
}

/** Reads the statements of a script. Nothing is sent before the whole script was read without a problem. */
function readScript(script: string): Statement[] {
    const lines = script.replace(/\r\n/g, '\n').split('\n');
    const format = /^-- @migace script format=(\d+)$/.exec(lines[0] ?? '');
    if (!format) {
        throw new Error('This is no migration script: its first line is not "-- @migace script format=…".');
    }
    if (Number(format[1]) !== SCRIPT_FORMAT) {
        throw new Error(`This runner reads the script format ${SCRIPT_FORMAT}. The script has the format ${format[1]}.`);
    }
    const statements: Statement[] = [];
    let current: { kind: 'statement' | 'guard', label?: string, lines: string[] } | undefined;
    let guard: string | undefined;
    const close = () => {
        const sql = current?.lines.join('\n').trim() ?? '';
        if (current?.kind === 'guard') {
            guard = sql;
        } else if (current) {
            statements.push({ sql, ...(guard !== undefined ? { guard } : {}), ...(current.label ? { label: current.label } : {}) });
            guard = undefined;
        }
    };
    lines.slice(1).forEach((line, index) => {
        const lineNumber = index + 2;
        const marker = MARKER.exec(line);
        if (!marker) {
            if (current) {
                current.lines.push(line);
            } else if (line.trim().length > 0) {
                throw new Error(`Line ${lineNumber}: text outside a statement.`);
            }
            return;
        }
        const kind = marker[1];
        if (kind !== 'statement' && kind !== 'guard') {
            throw new Error(`Line ${lineNumber}: unknown marker "${kind}".`);
        }
        if (current?.kind === 'guard' && kind === 'guard') {
            throw new Error(`Line ${lineNumber}: a guard is followed by a statement.`);
        }
        close();
        current = { kind, label: /label="([^"]*)"/.exec(marker[2])?.[1], lines: [] };
    });
    if (current?.kind === 'guard') {
        throw new Error(`Line ${lines.length}: a guard is followed by a statement.`);
    }
    close();
    return statements;
}
