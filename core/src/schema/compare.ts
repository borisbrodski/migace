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
                return [object, [{ kind: 'different', object: title(object), property: 'name', expected: localName(object), actual: localName(newName) }]];
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
            : `${head}: ${difference.property}: expected ${expected}, actual ${actual}\n`;
    }).join('');
}

function block(value: string): string {
    return value.split('\n').map(line => `    |${line}`).join('\n');
}

function title(object: SchemaObject): string {
    return `${object.kind} ${object.name}`;
}

function localName(object: SchemaObject): string {
    return object.table ? object.name.substring(object.table.length + 1) : object.name;
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

/**
 * A constraint or an index that is missing under its name and there under another one,
 * with the same definition in the same table, is the same object with another name.
 */
function renamedObjects(missing: SchemaObject[], unexpected: SchemaObject[]): Map<SchemaObject, SchemaObject> {
    const renamed = new Map<SchemaObject, SchemaObject>();
    const free = unexpected.filter(isNamedByLabel);
    for (const object of missing.filter(isNamedByLabel)) {
        const index = free.findIndex(other => other.kind === object.kind && other.table === object.table
            && JSON.stringify(other.properties) === JSON.stringify(object.properties));
        if (index >= 0) {
            renamed.set(object, free.splice(index, 1)[0]);
        }
    }
    return renamed;
}
