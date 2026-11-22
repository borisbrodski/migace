import type { SchemaModel } from './model.js';
import { compareText, inFixedOrder, isNamedByLabel, objectsOf, type SchemaObject } from './objects.js';

export interface Difference {
    /** `missing`: expected and not there. `unexpected`: there and not expected. `different`: there, with another property. */
    kind: 'missing' | 'unexpected' | 'different';
    /** The kind and the name of the object, for example `column orders.status`. */
    object: string;
    /** For `different`: the property, and its value in both models. A value that is not set is left out. */
    property?: string;
    expected?: string;
    actual?: string;
    /** A remark for the reader, for example that two names differ only in case. */
    note?: string;
}

/**
 * Lists every difference between the schema that is expected and the schema that is there.
 * The list has the order of the canonical form.
 */
export function compare(expected: SchemaModel, actual: SchemaModel): Difference[] {
    const expectedObjects = objectsOf(expected);
    const actualObjects = new Map(objectsOf(actual).map(object => [title(object), object]));
    const expectedTitles = new Set(expectedObjects.map(title));
    const unexpected = [...actualObjects.values()].filter(object => !expectedTitles.has(title(object)));
    const missing = expectedObjects.filter(object => !actualObjects.has(title(object)));
    const renamed = renamedObjects(missing, unexpected);
    // The objects of a table that is missing, unexpected or renamed are not listed one by one.
    const goneTables = new Set([...missing, ...unexpected].filter(object => object.kind === 'table').map(object => object.name));
    const isPartOfGoneTable = (object: SchemaObject) => object.kind !== 'table' && object.table !== undefined && goneTables.has(object.table);

    const positioned: Array<[SchemaObject, Difference[]]> = [
        ...expectedObjects.map((object): [SchemaObject, Difference[]] => {
            const other = actualObjects.get(title(object));
            if (other) {
                return [object, changedProperties(object, other)];
            }
            const newName = renamed.get(object);
            if (newName) {
                return [object, [{
                    kind: 'different', object: title(object), property: 'name', expected: localName(object), actual: localName(newName),
                    ...(differOnlyInCase(localName(object), localName(newName)) ? { note: ONLY_IN_CASE } : {}),
                }]];
            }
            return [object, isPartOfGoneTable(object) ? [] : [{ kind: 'missing', object: title(object) }]];
        }),
        ...unexpected
            .filter(object => ![...renamed.values()].includes(object) && !isPartOfGoneTable(object))
            .map((object): [SchemaObject, Difference[]] => [object, [{ kind: 'unexpected', object: title(object) }]]),
    ];
    return positioned
        .sort(([a], [b]) => inFixedOrder(a, b))
        .flatMap(([, differences]) => differences);
}

/** One line per difference. A value over several lines is written below, as in the canonical form. */
export function differencesText(differences: Difference[]): string {
    return differences.map(difference => {
        const head = `${difference.kind.padEnd(10)}  ${difference.object}`;
        if (difference.kind !== 'different') {
            return `${head}\n`;
        }
        const expected = difference.expected ?? 'nothing';
        const actual = difference.actual ?? 'nothing';
        return expected.includes('\n') || actual.includes('\n')
            ? `${head}: ${difference.property}: expected\n${block(expected)}\n  actual\n${block(actual)}\n`
            : `${head}: ${difference.property}: expected ${expected}, actual ${actual}${difference.note ? ` (${difference.note})` : ''}\n`;
    }).join('');
}

function block(value: string): string {
    return value.split('\n').map(line => `    |${line}`).join('\n');
}

function title(object: SchemaObject): string {
    return `${object.kind} ${object.name}`;
}

function localName(object: SchemaObject): string {
    return object.table !== undefined && object.kind !== 'table' ? object.name.substring(object.table.length + 1) : object.name;
}

function changedProperties(expected: SchemaObject, actual: SchemaObject): Difference[] {
    const names = [...new Set([...Object.keys(expected.properties), ...Object.keys(actual.properties)])].sort(compareText);
    return names
        .filter(name => expected.properties[name] !== actual.properties[name])
        .map(name => ({
            kind: 'different', object: title(expected), property: name,
            expected: expected.properties[name], actual: actual.properties[name],
        }));
}

const ONLY_IN_CASE = 'the names differ only in case';

function differOnlyInCase(a: string, b: string): boolean {
    return a !== b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Finds the objects that are missing under one name and there under another one, with the same definition
 * in the same place. For a constraint or an index the name is only a label, so any other name counts.
 * For a table, a column or a sequence only a name that differs in case counts: that is a slip of the author,
 * while another name is another object. Two tables have the same definition when their columns are the same and
 * their constraints and indexes have the same definitions; names that the database derived from the table name may differ.
 */
function renamedObjects(missing: SchemaObject[], unexpected: SchemaObject[]): Map<SchemaObject, SchemaObject> {
    const renamed = new Map<SchemaObject, SchemaObject>();
    const free = [...unexpected];
    const definition = (object: SchemaObject) => (object.kind === 'table'
        ? JSON.stringify([...missing, ...unexpected].filter(part => part.table === object.name).map(part => [part.kind, part.kind === 'table' || isNamedByLabel(part) ? '' : localName(part), part.properties]))
        : JSON.stringify(object.properties));
    for (const object of missing) {
        const index = free.findIndex(other => other.kind === object.kind
            && (object.kind === 'table' || other.table === object.table)
            && (isNamedByLabel(object) || (CASE_MATTERS.has(object.kind) && differOnlyInCase(localName(object), localName(other))))
            && definition(other) === definition(object));
        if (index >= 0) {
            renamed.set(object, free.splice(index, 1)[0]);
        }
    }
    return renamed;
}

const CASE_MATTERS: ReadonlySet<string> = new Set(['table', 'column', 'sequence']);

/** Names of one kind in one place that differ only in case. Some databases take them for one name. */
export interface NamesInAnotherCase {
    kind: string;
    /** The table, for the names of columns, constraints, indexes and triggers. */
    table?: string;
    names: string[];
}

export function namesThatDifferOnlyInCase(model: SchemaModel): NamesInAnotherCase[] {
    const groups = new Map<string, SchemaObject[]>();
    for (const object of objectsOf(model)) {
        const place = object.kind === 'table' ? '' : object.table ?? '';
        const key = JSON.stringify([object.kind, place, localName(object).toLowerCase()]);
        groups.set(key, [...(groups.get(key) ?? []), object]);
    }
    return [...groups.values()].filter(group => group.length > 1).map(group => ({
        kind: group[0].kind,
        ...(group[0].kind !== 'table' && group[0].table !== undefined ? { table: group[0].table } : {}),
        names: group.map(localName),
    }));
}
