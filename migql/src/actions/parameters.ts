import { GrammarUtils } from 'langium';
import type { ActionEntry, ColumnValue, Expression } from '../generated/ast.js';
import { isBooleanLiteral, isFunctionCall, isNameList, isNameRef, isNumberLiteral } from '../generated/ast.js';
import { type Action, actionNamed } from './catalogue.js';

/** A type as an author writes it: `varchar(200)`. */
export interface TypeSpec {
    name: string;
    parameters: number[];
    /** A type name in double quotes is always a type of the schema. */
    quoted: boolean;
}

/** The name of the action of an entry, without the colon of its key. */
export function actionName(entry: ActionEntry): string {
    return entry.action.slice(0, -1);
}

export function actionOf(entry: ActionEntry): Action {
    return actionNamed(actionName(entry))!;
}

/** The parameters as written, in the one-line form or in the block form. */
export function parametersOf(entry: ActionEntry): ColumnValue[] {
    return entry.map ? entry.map.values : entry.values;
}

export function parameter(entry: ActionEntry, name: string): Expression | undefined {
    return parametersOf(entry).find(each => each.column === name)?.value;
}

/** The value as one name, if it is one. */
export function asName(value: Expression | undefined): string | undefined {
    return value && isNameRef(value) ? value.target.$refText : undefined;
}

/** The value as a list of names: one name, or a list in square brackets. */
export function asNames(value: Expression | undefined): string[] | undefined {
    if (value && isNameList(value)) {
        return value.names;
    }
    const single = asName(value);
    return single === undefined ? undefined : [single];
}

/** The value as a type. A type is written like a name, or like a call with numbers: `varchar(200)`. */
export function asType(value: Expression | undefined): TypeSpec | undefined {
    if (value && isNameRef(value)) {
        return { name: value.target.$refText, parameters: [], quoted: value.$cstNode?.text.startsWith('"') ?? false };
    }
    if (value && isFunctionCall(value) && !value.star && value.arguments.every(isNumberLiteral)) {
        const written = GrammarUtils.findNodeForProperty(value.$cstNode, 'name')?.text ?? '';
        return { name: value.name, parameters: value.arguments.map(argument => (isNumberLiteral(argument) ? argument.value : 0)), quoted: written.startsWith('"') };
    }
    return undefined;
}

export function asBoolean(value: Expression | undefined): boolean | undefined {
    return value && isBooleanLiteral(value) ? value.value : undefined;
}
