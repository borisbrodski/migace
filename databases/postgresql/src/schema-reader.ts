import type {
    CheckConstraint, Column, Domain, EnumType, ForeignKey, Index, Routine, SchemaModel, SchemaReader, Sequence, Table, Trigger, View,
} from '@migace/core';
import * as catalog from './catalog-queries.js';

type Row = Record<string, unknown>;

/** Runs one query and returns its rows. This is all the reader needs from a connection. */
export type Query = (sql: string, parameters?: unknown[]) => Promise<Row[]>;

export interface ReadOptions {
    /** The schema to read. Nothing outside it becomes part of the model, except the list of extensions. */
    schema: string;
    /** Tables whose name starts with this prefix are the ledger of MIG-Ace and are left out. Default: `mig_`. */
    ledgerPrefix?: string;
}

const ACTIONS: Record<string, string> = { a: 'no action', r: 'restrict', c: 'cascade', n: 'set null', d: 'set default' };
const IDENTITIES: Record<string, Column['identity']> = { a: 'always', d: 'by default' };

/** Reads the catalog of a PostgreSQL database into the schema model. */
export class PostgresqlSchemaReader implements SchemaReader {

    private readonly ledgerPrefix: string;

    constructor(private readonly query: Query, private readonly options: ReadOptions) {
        this.ledgerPrefix = options.ledgerPrefix ?? 'mig_';
    }

    /**
     * PostgreSQL writes a name with its schema when the schema is not in the search path.
     * The schema is therefore put into the search path while the catalog is read. The model
     * of a schema is then the same, whatever the connection was set to.
     */
    async read(): Promise<SchemaModel> {
        const [setting] = await this.query("select current_setting('search_path') as path");
        await this.query("select set_config('search_path', $1, false)", [`"${this.options.schema.replace(/"/g, '""')}"`]);
        try {
            return await this.readCatalog();
        } finally {
            if (setting) {
                await this.query("select set_config('search_path', $1, false)", [text(setting.path)]);
            }
        }
    }

    private async readCatalog(): Promise<SchemaModel> {
        const inSchema = (sql: string) => this.query(sql, [this.options.schema]);
        const ofApplication = (row: Row) => !text(row.table ?? row.name).startsWith(this.ledgerPrefix);
        const tableRows = (await inSchema(catalog.TABLES)).filter(ofApplication);
        const columns = (await inSchema(catalog.COLUMNS)).filter(ofApplication);
        const constraints = (await inSchema(catalog.CONSTRAINTS)).filter(ofApplication);
        const indexes = (await inSchema(catalog.INDEXES)).filter(ofApplication);
        const triggers = (await inSchema(catalog.TRIGGERS)).filter(ofApplication);
        const of = (rows: Row[], table: unknown) => rows.filter(row => row.table === table);

        return {
            tables: tableRows.map((row): Table => {
                const own = of(constraints, row.name);
                const keys = (kind: string) => own.filter(each => each.kind === kind).map(each => ({ name: text(each.name), columns: list(each.columns) }));
                return {
                    name: text(row.name),
                    ...optional('comment', textOrNothing(row.comment)),
                    columns: of(columns, row.name).map(column),
                    ...(keys('p').length > 0 ? { primaryKey: keys('p')[0] } : {}),
                    uniques: keys('u'),
                    foreignKeys: own.filter(each => each.kind === 'f').map(foreignKey),
                    checks: own.filter(each => each.kind === 'c').map(each => ({ name: text(each.name), expression: text(each.expression) })),
                    indexes: of(indexes, row.name).map(index),
                    triggers: of(triggers, row.name).map(trigger),
                };
            }),
            sequences: (await inSchema(catalog.SEQUENCES)).map(sequence),
            views: (await inSchema(catalog.VIEWS)).map((row): View => ({
                name: text(row.name), definition: text(row.definition), ...optional('comment', textOrNothing(row.comment)),
            })),
            routines: (await inSchema(catalog.ROUTINES)).map(routine),
            enums: (await inSchema(catalog.ENUMS)).map((row): EnumType => ({ name: text(row.name), labels: list(row.labels) })),
            domains: (await inSchema(catalog.DOMAINS)).map(domain),
            extensions: (await this.query(catalog.EXTENSIONS)).map(row => ({ name: text(row.name) })),
        };
    }
}

function column(row: Row): Column {
    return {
        name: text(row.name),
        ...typeOf(text(row.type)),
        nullable: row.nullable === true,
        ...optional('default', textOrNothing(row.default)),
        ...optional('identity', IDENTITIES[text(row.identity)]),
        ...optional('comment', textOrNothing(row.comment)),
    };
}

/** `character varying(100)` is the type `character varying` with the details `100`. */
function typeOf(formatted: string): { type: string, typeDetails?: string } {
    const withDetails = /^([^(]*)\(([^)]*)\)(.*)$/.exec(formatted);
    return withDetails ? { type: withDetails[1] + withDetails[3], typeDetails: withDetails[2] } : { type: formatted };
}

function foreignKey(row: Row): ForeignKey {
    return {
        name: text(row.name),
        columns: list(row.columns),
        target: text(row.target),
        targetColumns: list(row.target_columns),
        onUpdate: ACTIONS[text(row.on_update)],
        onDelete: ACTIONS[text(row.on_delete)],
    };
}

function index(row: Row): Index {
    return {
        name: text(row.name),
        unique: row.unique === true,
        method: text(row.method),
        columns: indexColumns(text(row.definition)),
        ...optional('condition', textOrNothing(row.condition)),
    };
}

/**
 * The columns or expressions of an index, as PostgreSQL writes them in the definition of the index:
 * `CREATE INDEX … USING btree (customer_id, created_at DESC)`. This form keeps the order and the operator class.
 */
function indexColumns(definition: string): string[] {
    const start = definition.indexOf('(', definition.indexOf(' USING '));
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const character of definition.substring(start)) {
        depth += character === '(' ? 1 : character === ')' ? -1 : 0;
        if (depth === 0) {
            break;
        }
        if (character === ',' && depth === 1) {
            parts.push(current.trim());
            current = '';
        } else if (!(character === '(' && depth === 1 && current === '')) {
            current += character;
        }
    }
    return [...parts, current.trim()];
}

/** The bits of `pg_trigger.tgtype`. */
const ROW = 1, BEFORE = 2, INSERT = 4, DELETE = 8, UPDATE = 16, TRUNCATE = 32, INSTEAD = 64;

function trigger(row: Row): Trigger {
    const type = Number(row.type);
    const events = [[INSERT, 'insert'], [DELETE, 'delete'], [UPDATE, 'update'], [TRUNCATE, 'truncate']] as const;
    const condition = /\bWHEN \((.*)\) EXECUTE\b/s.exec(text(row.definition));
    return {
        name: text(row.name),
        timing: type & INSTEAD ? 'instead of' : type & BEFORE ? 'before' : 'after',
        events: events.filter(([bit]) => type & bit).map(([, name]) => name),
        level: type & ROW ? 'row' : 'statement',
        function: text(row.function),
        ...optional('condition', condition ? `(${condition[1]})` : undefined),
    };
}

function sequence(row: Row): Sequence {
    return {
        name: text(row.name), type: text(row.type), start: text(row.start), increment: text(row.increment),
        min: text(row.min), max: text(row.max), cache: text(row.cache), cycle: row.cycle === true,
    };
}

function routine(row: Row): Routine {
    const kind = row.kind === 'p' ? 'procedure' : 'function';
    return {
        kind,
        name: text(row.name),
        arguments: text(row.arguments),
        ...(kind === 'function' ? optional('returns', textOrNothing(row.returns)) : {}),
        language: text(row.language),
        body: text(row.body),
        ...optional('comment', textOrNothing(row.comment)),
    };
}

function domain(row: Row): Domain {
    const checks = row.checks ? JSON.parse(text(row.checks)) as Array<{ name: string, definition: string }> : [];
    return {
        name: text(row.name),
        type: text(row.type),
        nullable: row.nullable === true,
        ...optional('default', textOrNothing(row.default)),
        checks: checks.map((check): CheckConstraint => ({ name: check.name, expression: check.definition.replace(/^CHECK \((.*)\)$/s, '$1') })),
    };
}

function text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
}

function textOrNothing(value: unknown): string | undefined {
    return value === null || value === undefined ? undefined : String(value);
}

/** A list that the query returned as JSON text. */
function list(value: unknown): string[] {
    return value ? JSON.parse(text(value)) as string[] : [];
}

/** A property that is left out of the model when the database has no value for it. */
function optional<K extends string, V>(name: K, value: V | null | undefined): { [key in K]?: V } {
    return (value === null || value === undefined ? {} : { [name]: value }) as { [key in K]?: V };
}
