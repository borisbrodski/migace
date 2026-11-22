import type { DataType, Expression, Select } from '../../src/generated/ast.js';
import { knownType } from '../../src/types.js';
import { name, text } from './names.js';

/** Functions of the statement language that PostgreSQL spells differently. All others keep their name. */
const FUNCTIONS: Record<string, (args: string[]) => string> = {
    days: args => `make_interval(days => ${args.join(', ')})`,
};

export function expression(node: Expression): string {
    const not = (negated: boolean) => (negated ? ' not' : '');
    switch (node.$type) {
        case 'BinaryExpression': return `${expression(node.left)} ${node.operator.toLowerCase()} ${expression(node.right)}`;
        case 'NotExpression': return `not ${expression(node.operand)}`;
        case 'NegativeExpression': return `-${expression(node.operand)}`;
        case 'IsNullExpression': return `${expression(node.operand)} is${not(node.negated)} null`;
        case 'InExpression': return `${expression(node.operand)}${not(node.negated)} in ` +
            `(${node.query ? select(node.query) : node.values.map(expression).join(', ')})`;
        case 'BetweenExpression': return `${expression(node.operand)}${not(node.negated)} between ` +
            `${expression(node.low)} and ${expression(node.high)}`;
        case 'LikeExpression': return `${expression(node.operand)}${not(node.negated)} like ${expression(node.pattern)}`;
        case 'ParenExpression': return `(${expression(node.expression)})`;
        case 'SubqueryExpression': return `(${select(node.query)})`;
        case 'ExistsExpression': return `exists (${select(node.query)})`;
        case 'CaseExpression': return [
            'case',
            ...(node.subject ? [expression(node.subject)] : []),
            ...node.branches.map(branch => `when ${expression(branch.condition)} then ${expression(branch.result)}`),
            ...(node.otherwise ? [`else ${expression(node.otherwise)}`] : []),
            'end',
        ].join(' ');
        case 'CastExpression': return `cast(${expression(node.expression)} as ${dataType(node.type)})`;
        case 'NextValueExpression': return `nextval(${text(name(node.sequence))})`;
        case 'FunctionCall': return functionCall(node.name, node.star ? ['*'] : node.arguments.map(expression));
        case 'ColumnRef': return `${name(node.table)}.${name(node.column)}`;
        case 'NameRef': return name(node.target.$refText);
        case 'StringLiteral': return text(node.value);
        case 'NumberLiteral': return node.$cstNode?.text ?? String(node.value);
        case 'DateLiteral': return `date ${text(node.value)}`;
        case 'NullLiteral': return 'null';
        case 'BooleanLiteral': return String(node.value);
        default: throw new Error(`${node.$type} cannot be generated for PostgreSQL yet.`);
    }
}

export function select(query: Select): string {
    return `select ${query.items.map(expression).join(', ')} from ${name(query.table)}` +
        (query.alias ? ` ${name(query.alias)}` : '') +
        (query.condition ? ` where ${expression(query.condition)}` : '');
}

export function dataType(type: DataType): string {
    return typeName(type) + (type.parameters.length > 0 ? `(${type.parameters.join(', ')})` : '');
}

/** A type that MigQL knows has the same name in PostgreSQL. Every other type is a type of the schema with an exact name. */
export function typeName(type: DataType): string {
    return isKnownType(type) ? knownType(type.name)! : name(type.name);
}

/** A type name in quotes is always a type of the schema, also when it is spelled like a type that MigQL knows. */
export function isKnownType(type: DataType): boolean {
    return knownType(type.name) !== undefined && !type.$cstNode?.text.startsWith('"');
}

function functionCall(written: string, args: string[]): string {
    const special = FUNCTIONS[written.toLowerCase()];
    return special ? special(args) : `${written.toLowerCase()}(${args.join(', ')})`;
}
