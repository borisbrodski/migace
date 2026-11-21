import type { SchemaModel, Table } from './model.js';

/** The kinds of objects, in the order in which they are listed. */
export const OBJECT_KINDS = [
    'extension', 'enum type', 'domain', 'sequence',
    'table', 'column', 'primary key', 'unique constraint', 'foreign key', 'check constraint', 'index', 'trigger',
    'view', 'function', 'procedure',
] as const;

export type ObjectKind = typeof OBJECT_KINDS[number];

/** Kinds whose name is only a label: two objects with the same definition and different names are the same thing. */
const NAMED_BY_LABEL: ReadonlySet<ObjectKind> = new Set(['primary key', 'unique constraint', 'foreign key', 'check constraint', 'index']);

/**
 * One object of a schema in a flat form: what it is, how it is called and what it is like.
 * The canonical form, the comparison and the fingerprint all work on this form.
 */
export interface SchemaObject {
    kind: ObjectKind;
    /** The full name. Objects of a table start with the name of the table: `orders.status`. */
    name: string;
    /** The table this object belongs to. */
    table?: string;
    /** Every property as text. A property that is not set is left out. */
    properties: Record<string, string>;
}

export function isNamedByLabel(object: SchemaObject): boolean {
    return NAMED_BY_LABEL.has(object.kind);
}

/** The objects of a model in a fixed order: by table, then by kind, then by name. */
export function objectsOf(model: SchemaModel): SchemaObject[] {
    const objects: SchemaObject[] = [
        ...model.extensions.map(extension => object('extension', extension.name, {})),
        ...model.enums.map(type => object('enum type', type.name, { labels: list(type.labels) })),
        ...model.domains.map(domain => object('domain', domain.name, {
            'type': domain.type,
            'nullable': yesNo(domain.nullable),
            'default': domain.default,
            ...Object.fromEntries(domain.checks.map(check => [`check ${check.name}`, check.expression])),
        })),
        ...model.sequences.map(sequence => object('sequence', sequence.name, {
            type: sequence.type, start: sequence.start, increment: sequence.increment,
            min: sequence.min, max: sequence.max, cache: sequence.cache, cycle: yesNo(sequence.cycle),
        })),
        ...model.tables.flatMap(objectsOfTable),
        ...model.views.map(view => object('view', view.name, { definition: view.definition, comment: view.comment })),
        ...model.routines.map(routine => object(routine.kind, `${routine.name}(${routine.arguments})`, {
            returns: routine.returns, language: routine.language, body: routine.body, comment: routine.comment,
        })),
    ];
    return objects.sort(inFixedOrder);
}

function objectsOfTable(table: Table): SchemaObject[] {
    const inTable = (kind: ObjectKind, name: string, properties: Record<string, string | undefined>) =>
        ({ ...object(kind, `${table.name}.${name}`, properties), table: table.name });
    return [
        { ...object('table', table.name, { comment: table.comment }), table: table.name },
        ...table.columns.map(column => inTable('column', column.name, {
            'type': column.type,
            'type details': column.typeDetails,
            'nullable': yesNo(column.nullable),
            'default': column.default,
            'identity': column.identity,
            'comment': column.comment,
        })),
        ...(table.primaryKey ? [inTable('primary key', table.primaryKey.name, { columns: list(table.primaryKey.columns) })] : []),
        ...table.uniques.map(unique => inTable('unique constraint', unique.name, { columns: list(unique.columns) })),
        ...table.foreignKeys.map(key => inTable('foreign key', key.name, {
            'columns': list(key.columns),
            'references': `${key.target} (${list(key.targetColumns)})`,
            'on update': key.onUpdate,
            'on delete': key.onDelete,
        })),
        ...table.checks.map(check => inTable('check constraint', check.name, { expression: check.expression })),
        ...table.indexes.map(index => inTable('index', index.name, {
            columns: list(index.columns), unique: yesNo(index.unique), method: index.method, condition: index.condition,
        })),
        ...table.triggers.map(trigger => inTable('trigger', trigger.name, {
            timing: trigger.timing, events: list(trigger.events), level: trigger.level,
            function: trigger.function, condition: trigger.condition,
        })),
    ];
}

function object(kind: ObjectKind, name: string, properties: Record<string, string | undefined>): SchemaObject {
    const set = Object.entries(properties).filter((entry): entry is [string, string] => entry[1] !== undefined);
    return { kind, name, properties: Object.fromEntries(set.sort(([a], [b]) => compareText(a, b))) };
}

/** Objects of one table stay together, after the objects that tables may use and before those that use tables. */
export function inFixedOrder(a: SchemaObject, b: SchemaObject): number {
    const group = (each: SchemaObject) => (each.table !== undefined ? OBJECT_KINDS.indexOf('table') : OBJECT_KINDS.indexOf(each.kind));
    return group(a) - group(b)
        || compareText(a.table ?? '', b.table ?? '')
        || OBJECT_KINDS.indexOf(a.kind) - OBJECT_KINDS.indexOf(b.kind)
        || compareText(a.name, b.name);
}

/** Compares by code points, so the order is the same on every computer. */
export function compareText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function list(items: string[]): string {
    return items.join(', ');
}

function yesNo(value: boolean): string {
    return value ? 'yes' : 'no';
}
