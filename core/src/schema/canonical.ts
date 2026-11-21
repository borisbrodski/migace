import { createHash } from 'node:crypto';
import type { SchemaModel } from './model.js';
import { objectsOf, type SchemaObject } from './objects.js';

/**
 * The model as text: every object with its properties, in a fixed order.
 * Two models are equal exactly when their canonical forms are equal, and a difference
 * between two fingerprints can be explained by a diff of the two texts.
 */
export function canonicalForm(model: SchemaModel): string {
    return objectsOf(model).map(objectText).join('\n');
}

/** The SHA-256 hash of the canonical form, as 64 hexadecimal digits. */
export function fingerprint(model: SchemaModel): string {
    return createHash('sha256').update(canonicalForm(model)).digest('hex');
}

function objectText(object: SchemaObject): string {
    const properties = Object.entries(object.properties).map(([name, value]) => `  ${name}:${valueText(value)}\n`);
    return `${object.kind} ${object.name}\n${properties.join('')}`;
}

/** A value over several lines is written below its name, every line behind a bar, so that white space at the ends is visible. */
function valueText(value: string): string {
    return value.includes('\n') ? '\n' + value.split('\n').map(line => `    |${line}`).join('\n') : ` ${value}`;
}
