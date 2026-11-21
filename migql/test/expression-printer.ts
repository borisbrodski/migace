import type { AstNode } from 'langium';
import type { DataType, Expression, Select } from '../src/generated/ast.js';

/**
 * Prints an expression with every operation in brackets, so that a test shows how the parser
 * grouped it. Brackets the author wrote appear as `paren(…)`.
 */
export function printExpression(node: Expression): string {
    const not = (negated: boolean) => (negated ? ' not' : '');
    switch (node.$type) {
        case 'BinaryExpression': return `(${printExpression(node.left)} ${node.operator.toLowerCase()} ${printExpression(node.right)})`;
        case 'NotExpression': return `(not ${printExpression(node.operand)})`;
        case 'NegativeExpression': return `(-${printExpression(node.operand)})`;
        case 'IsNullExpression': return `(${printExpression(node.operand)} is${not(node.negated)} null)`;
        case 'InExpression': return `(${printExpression(node.operand)}${not(node.negated)} in ` +
            `(${node.query ? printSelect(node.query) : node.values.map(printExpression).join(', ')}))`;
        case 'BetweenExpression': return `(${printExpression(node.operand)}${not(node.negated)} between ` +
            `${printExpression(node.low)} and ${printExpression(node.high)})`;
        case 'LikeExpression': return `(${printExpression(node.operand)}${not(node.negated)} like ${printExpression(node.pattern)})`;
        case 'ParenExpression': return `paren(${printExpression(node.expression)})`;
        case 'SubqueryExpression': return printSelect(node.query);
        case 'ExistsExpression': return `exists(${printSelect(node.query)})`;
        case 'CaseExpression': return 'case(' + [
            ...(node.subject ? [printExpression(node.subject)] : []),
            ...node.branches.map(branch => `when ${printExpression(branch.condition)} then ${printExpression(branch.result)}`),
            ...(node.otherwise ? [`else ${printExpression(node.otherwise)}`] : []),
        ].join('; ') + ')';
        case 'CastExpression': return `cast(${printExpression(node.expression)} as ${printType(node.type)})`;
        case 'NextValueExpression': return `next(${node.sequence})`;
        case 'FunctionCall': return `${node.name}(${node.star ? '*' : node.arguments.map(printExpression).join(', ')})`;
        case 'ColumnRef': return `${node.table}.${node.column}`;
        case 'NameRef': return node.target.$refText;
        case 'StringLiteral': return `'${node.value}'`;
        case 'NumberLiteral': return String(node.value);
        case 'DateLiteral': return `date('${node.value}')`;
        case 'NullLiteral': return 'null';
        case 'BooleanLiteral': return String(node.value);
        case 'Placeholder': return '?';
        case 'ColumnExists': return `column-exists(${node.table}.${node.column})`;
        case 'TableExists': return `table-exists(${node.table})`;
        case 'IndexExists': return `index-exists(${node.index})`;
        case 'RanCondition': return `ran(${node.part.$refText}${node.release ? ' from ' + node.release : ''})`;
        default: return unknown(node);
    }
}

export function printSelect(select: Select): string {
    return '<select ' + select.items.map(printExpression).join(', ') +
        ` from ${select.table}${select.alias ? ' ' + select.alias : ''}` +
        (select.condition ? ` where ${printExpression(select.condition)}` : '') + '>';
}

export function printType(type: DataType): string {
    return type.name + (type.parameters.length > 0 ? `(${type.parameters.join(', ')})` : '');
}

function unknown(node: AstNode): never {
    throw new Error(`The printer does not know ${node.$type}.`);
}
