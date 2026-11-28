/**
 * The reference runner: it sends a migration script to a database, one statement at a time.
 * All logic of a migration is in the script. A runner in another language does the same and no more.
 * The contract is described in clients/contract/README.md, and its cases are data files there.
 */

/** Runs one statement and returns its rows. Notices of the server go to `onNotice`. */
export type Execute = (sql: string, onNotice: (message: string) => void) => Promise<Array<Record<string, unknown>>>;

export interface RunOptions {
    /** Names and values that the script reads as session settings `migace.<name>`, for example the schema. */
    parameters?: Record<string, string>;
    onNotice?: (message: string) => void;
}

/** The script stopped at a statement that the database refused, or at a guard that gave no clear answer. */
export class ScriptFailed extends Error {
    /** The code of the database for the error, if the database gave one. */
    code?: string;
}

/** The text is no script that this runner can read. Nothing was sent. */
export class ScriptRefused extends Error { }

const SCRIPT_FORMAT = 1;
const MARKER = /^-- @migace (\S+)(.*)$/;

interface Statement {
    sql: string;
    /** A query that says whether the statement runs. */
    guard?: string;
    /** Says what the statement belongs to, for the message of an error. */
    label?: string;
    /** The line of the marker in the script. */
    line: number;
}

export async function runScript(script: string, execute: Execute, options: RunOptions = {}): Promise<void> {
    const { statements, finallyStatements } = readScript(script);
    const parameters = Object.entries(options.parameters ?? {});
    const badName = parameters.find(([name]) => !/^\w+$/.test(name));
    if (badName) {
        throw new ScriptRefused(`The name of a parameter is made of letters, digits and underscores: "${badName[0]}".`);
    }
    const onNotice = options.onNotice ?? (() => undefined);
    const send = async (sql: string, label?: string) => {
        try {
            return await execute(sql, onNotice);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const failed = new ScriptFailed(label ? `${label}: ${message}` : message, { cause: error });
            failed.code = (error as { code?: unknown }).code === undefined ? undefined : String((error as { code?: unknown }).code);
            throw failed;
        }
    };
    const sendStatement = async (statement: Statement) => {
        if (statement.guard === undefined || guardSays(await send(statement.guard, statement.label), statement)) {
            await send(statement.sql, statement.label);
        }
    };
    let firstError: unknown;
    try {
        for (const [name, value] of parameters) {
            await send(`select set_config('migace.${name}', '${value.replace(/'/g, "''")}', false)`);
        }
        // The script cannot see which settings exist. It learns the names from this list and refuses one it does not know.
        if (parameters.length > 0) {
            await send(`select set_config('migace.parameters', '${parameters.map(([name]) => name).join(',')}', false)`);
        }
        for (const statement of statements) {
            await sendStatement(statement);
        }
    } catch (error) {
        firstError = error;
    }
    // The statements after "-- @migace finally" are sent in any case. An error among them never hides the first one.
    for (const statement of finallyStatements) {
        try {
            await sendStatement(statement);
        } catch (error) {
            firstError ??= error;
        }
    }
    if (firstError !== undefined) {
        throw firstError;
    }
}

/** A guard answers with one row that holds true or false. Any other answer is an error: the runner does not guess. */
function guardSays(rows: Array<Record<string, unknown>>, statement: Statement): boolean {
    const value = rows.length === 1 ? Object.values(rows[0])[0] : undefined;
    if (value === true || value === false) {
        return value;
    }
    const answer = rows.length === 0 ? 'no row' : rows.length > 1 ? 'more than one row' : 'a row without true or false';
    throw new ScriptFailed(`The guard before the statement at line ${statement.line} returned ${answer}.`);
}

const guardWithoutStatement = (line: number) => new ScriptRefused(`Line ${line}: this guard is not followed by a statement.`);

/** Reads the statements of a script. Nothing is sent before the whole script was read without a problem. */
function readScript(script: string): { statements: Statement[], finallyStatements: Statement[] } {
    const lines = script.replace(/\r\n/g, '\n').split('\n');
    const format = /^-- @migace script format=(\d+)$/.exec(lines[0] ?? '');
    if (!format) {
        throw new ScriptRefused('This is no migration script: its first line is not "-- @migace script format=…".');
    }
    if (Number(format[1]) !== SCRIPT_FORMAT) {
        throw new ScriptRefused(`This runner reads the script format ${SCRIPT_FORMAT}. The script has the format ${format[1]}.`);
    }
    const statements: Statement[] = [];
    let finallyAt: number | undefined;
    let current: { kind: 'statement' | 'guard', label?: string, line: number, lines: string[] } | undefined;
    let guard: string | undefined;
    const close = () => {
        const sql = current?.lines.join('\n').trim() ?? '';
        if (current?.kind === 'guard') {
            guard = sql;
        } else if (current) {
            statements.push({ sql, line: current.line, ...(guard !== undefined ? { guard } : {}), ...(current.label ? { label: current.label } : {}) });
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
                throw new ScriptRefused(`Line ${lineNumber}: text outside a statement.`);
            }
            return;
        }
        const kind = marker[1];
        if (kind !== 'statement' && kind !== 'guard' && kind !== 'finally') {
            throw new ScriptRefused(`Line ${lineNumber}: unknown marker "${kind}".`);
        }
        if (current?.kind === 'guard' && kind !== 'statement') {
            throw guardWithoutStatement(current.line);
        }
        close();
        if (kind === 'finally') {
            if (finallyAt !== undefined) {
                throw new ScriptRefused(`Line ${lineNumber}: a second "-- @migace finally". A script has it at most once.`);
            }
            finallyAt = statements.length;
            current = undefined;
            return;
        }
        current = { kind, label: /label="([^"]*)"/.exec(marker[2])?.[1], line: lineNumber, lines: [] };
    });
    if (current?.kind === 'guard') {
        throw guardWithoutStatement(current.line);
    }
    close();
    return { statements: statements.slice(0, finallyAt), finallyStatements: finallyAt === undefined ? [] : statements.slice(finallyAt) };
}
