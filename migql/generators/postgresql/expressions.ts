import { AstUtils } from 'langium';
import type { DataType, Expression, RanCondition, Select } from '../../src/generated/ast.js';
import { isSnippet, isUidEntry } from '../../src/generated/ast.js';
import { isConditionName } from '../../src/references/names.js';
import type { TypeSpec } from '../../src/actions/parameters.js';
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
        // In a condition a name stands for its definition under `let`. Everywhere else it is a column.
        case 'NameRef': return isConditionName(node) && node.target.ref
            ? `(${expression(node.target.ref.condition)})`
            : name(node.target.$refText);
        case 'ColumnExists': return 'exists (select 1 from pg_attribute a ' +
            `where a.attrelid = to_regclass(${text(name(node.table))}) and a.attname = ${text(node.column)} and a.attnum > 0 and not a.attisdropped)`;
        case 'TableExists': return relationExists(node.table, ['r', 'p']);
        case 'IndexExists': return relationExists(node.index, ['i', 'I']);
        case 'RanCondition': return ranCondition(node);
        case 'StringLiteral': return text(node.value);
        case 'NumberLiteral': return node.$cstNode?.text ?? String(node.value);
        case 'DateLiteral': return `date ${text(node.value)}`;
        case 'NullLiteral': return 'null';
        case 'BooleanLiteral': return String(node.value);
        default: throw new Error(`${node.$type} cannot be generated for PostgreSQL yet.`);
    }
}

function relationExists(written: string, kinds: string[]): string {
    return `exists (select 1 from pg_class c where c.oid = to_regclass(${text(name(written))}) and c.relkind in (${kinds.map(text).join(', ')}))`;
}

/** Asks the ledger whether a part ran on this database. The script brings the function with it. */
function ranCondition(node: RanCondition): string {
    const part = node.part.ref;
    const uid = part ? AstUtils.getContainerOfType(part, isSnippet)?.entries.find(isUidEntry)?.value : undefined;
    if (!part || !uid) {
        throw new Error(`The part "${node.part.$refText}" of a "ran" condition is not known, or its snippet has no uid.`);
    }
    if (node.release) {
        throw new NeedsReleaseFiles(`"ran ${node.part.$refText} from ${node.release}" needs the checksums of a release file. Release files are not built yet; write the condition without "from".`);
    }
    return `pg_temp.migace_ran(${text(uid)}, ${text(part.name)})`;
}

/** A condition that asks for the version of a part that a release shipped. */
export class NeedsReleaseFiles extends Error { }

export function select(query: Select): string {
    return `select ${query.items.map(expression).join(', ')} from ${name(query.table)}` +
        (query.alias ? ` ${name(query.alias)}` : '') +
        (query.condition ? ` where ${expression(query.condition)}` : '');
}

export function dataType(type: DataType): string {
    return typeText(typeSpec(type));
}

export function typeSpec(type: DataType): TypeSpec {
    return { name: type.name, parameters: type.parameters, quoted: type.$cstNode?.text.startsWith('"') ?? false };
}

export function typeText(type: TypeSpec): string {
    return typeName(type) + (type.parameters.length > 0 ? `(${type.parameters.join(', ')})` : '');
}

/** A type that MigQL knows has the same name in PostgreSQL. Every other type is a type of the schema with an exact name. */
export function typeName(type: TypeSpec): string {
    return knownTypeOf(type) ?? name(type.name);
}

/** The type of the list of MigQL, if it is one. A type name in quotes is always a type of the schema. */
export function knownTypeOf(type: TypeSpec): string | undefined {
    return type.quoted ? undefined : knownType(type.name);
}

function functionCall(written: string, args: string[]): string {
    const special = FUNCTIONS[written.toLowerCase()];
    return special ? special(args) : `${written.toLowerCase()}(${args.join(', ')})`;
}
