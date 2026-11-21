import type {
    AlterTable, ColumnChange, ColumnConstraint, ColumnDefinition, ConstraintRule, DataType, EnsureColumn, Expression, Statement,
    TableConstraint,
} from '../../src/generated/ast.js';
import { dataType, expression, select } from './expressions.js';
import { name, plain, quoted, text } from './names.js';

/** A construct that the generator does not translate yet. */
export class NotGeneratedYet extends Error { }

/** One PostgreSQL statement, without the semicolon at its end. */
export interface Step {
    sql: string;
    /** Set for a statement that PostgreSQL refuses inside a transaction, such as `create index concurrently`. */
    outsideTransaction?: boolean;
}

/**
 * The PostgreSQL statements for one statement of the statement language.
 * Most statements are one step. Some are written in several steps that do not lock a table for long.
 */
export function statement(node: Statement): Step[] {
    switch (node.$type) {
        case 'CreateTable': return [{
            sql: [
                `create table ${name(node.name)} (`,
                node.elements.map(element => '    ' + (element.$type === 'ColumnDefinition' ? column(element) : constraint(element))).join(',\n'),
                ')',
            ].join('\n'),
        }];
        case 'AlterTable': return alterTable(node);
        case 'CreateIndex': return [{
            sql: `create ${node.unique ? 'unique ' : ''}index ${node.concurrently ? 'concurrently ' : ''}` +
                `${name(node.name)} on ${name(node.table)} (${names(node.columns)})`,
            outsideTransaction: node.concurrently,
        }];
        case 'DropTable': return [{ sql: `drop table ${name(node.name)}` }];
        case 'DropIndex': return [{
            sql: `drop index ${node.concurrently ? 'concurrently ' : ''}${name(node.name)}`,
            outsideTransaction: node.concurrently,
        }];
        case 'Update': return [{
            sql: `update ${name(node.table)}${alias(node.alias)} set ` +
                node.assignments.map(assignment => `${name(assignment.column)} = ${expression(assignment.value)}`).join(', ') +
                where(node.condition),
        }];
        case 'Delete': return [{ sql: `delete from ${name(node.table)}${alias(node.alias)}${where(node.condition)}` }];
        case 'Insert': return [{
            sql: `insert into ${name(node.table)} (${names(node.columns)}) ` +
                (node.query ? select(node.query) : `values (${node.values.map(expression).join(', ')})`),
        }];
        case 'EnsureColumn': return [{ sql: ensureColumn(node) }];
        // Without phases the column is renamed in one step. The form with a sync trigger comes with the upgrade phases.
        case 'RenameColumn': return [{ sql: `alter table ${name(node.table)} rename column ${name(node.column)} to ${name(node.newName)}` }];
    }
}

function alterTable(node: AlterTable): Step[] {
    const table = `alter table ${name(node.table)}`;
    const action = node.action;
    switch (action.$type) {
        case 'AddColumn': return [{ sql: `${table} add column ${column(action.column)}` }];
        case 'AddConstraint': {
            const added = `${table} add ${constraint(action.constraint)}`;
            // A foreign key is checked against all rows. Added as "not valid" and validated afterwards, it blocks writers only briefly.
            return action.constraint.rule.$type === 'ForeignKey' && action.constraint.name
                ? [{ sql: `${added} not valid` }, { sql: `${table} validate constraint ${name(action.constraint.name)}` }]
                : [{ sql: added }];
        }
        case 'DropColumn': return [{ sql: `${table} drop column ${name(action.column)}` }];
        case 'AlterColumn': return action.change.$type === 'SetNotNull'
            ? setNotNull(node.table, action.column)
            : [{ sql: `${table} alter column ${name(action.column)} ${columnChange(action.change)}` }];
    }
}

/**
 * `set not null` alone reads the whole table while it holds a lock that blocks everybody.
 * With a validated check constraint in place, PostgreSQL skips that scan.
 */
function setNotNull(table: string, columnName: string): Step[] {
    const alter = `alter table ${name(table)}`;
    const check = quoted(`${plain(table)}_${plain(columnName)}_not_null`);
    return [
        { sql: `${alter} add constraint ${check} check (${name(columnName)} is not null) not valid` },
        { sql: `${alter} validate constraint ${check}` },
        { sql: `${alter} alter column ${name(columnName)} set not null` },
        { sql: `${alter} drop constraint ${check}` },
    ];
}

/** Types whose details PostgreSQL stores as a length. A column of such a type can be made longer. */
const WITH_LENGTH = new Set(['varchar', 'character varying', 'char', 'character', 'bpchar']);

/**
 * `ensure column` cannot be decided when the script is built: the column may or may not exist in
 * the database that runs it. The decision is therefore made by code that runs in the database.
 */
function ensureColumn(node: EnsureColumn): string {
    const table = name(node.table);
    const columnName = name(node.column.name);
    const type = node.column.type;
    const wanted = `${plain(node.table)}.${plain(node.column.name)} ${dataType(type)}`;
    const isType = `existing.atttypid = ${text(name(type.name))}::regtype`;
    const modifier = typeModifier(type);
    const widen = WITH_LENGTH.has(plain(type.name)) && type.parameters.length === 1
        ? [`    elsif ${isType} and existing.atttypmod between 5 and ${modifier - 1} then`,
            `        alter table ${table} alter column ${columnName} type ${dataType(type)};`]
        : [];
    return [
        'do $ensure$',
        'declare',
        '    existing record;',
        'begin',
        '    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing',
        '    from pg_attribute a',
        `    where a.attrelid = ${text(table)}::regclass and a.attname = ${text(plain(node.column.name))} and a.attnum > 0 and not a.attisdropped;`,
        '    if not found then',
        `        alter table ${table} add column ${column(node.column)};`,
        `    elsif ${isType} and existing.atttypmod = ${modifier} then`,
        '        null;',
        ...widen,
        '    else',
        `        raise exception ${text(`ensure column ${wanted}: the column exists as %. It can neither be kept nor widened.`)}, existing.type;`,
        '    end if;',
        'end',
        '$ensure$',
    ].join('\n');
}

/** The number in which PostgreSQL stores the details of a type: the length plus 4, or -1 without details. */
function typeModifier(type: DataType): number {
    if (type.parameters.length === 0) {
        return -1;
    }
    if (WITH_LENGTH.has(plain(type.name)) && type.parameters.length === 1) {
        return type.parameters[0] + 4;
    }
    if (['numeric', 'decimal'].includes(plain(type.name))) {
        return ((type.parameters[0] << 16) | (type.parameters[1] ?? 0)) + 4;
    }
    throw new NotGeneratedYet(`"ensure column" knows the details of varchar, char and numeric only, not of ${dataType(type)}.`);
}

function names(written: string[]): string {
    return written.map(name).join(', ');
}

function alias(written: string | undefined): string {
    return written ? ` ${name(written)}` : '';
}

function where(condition: Expression | undefined): string {
    return condition ? ` where ${expression(condition)}` : '';
}

function columnChange(change: Exclude<ColumnChange, { $type: 'SetNotNull' }>): string {
    switch (change.$type) {
        case 'DropNotNull': return 'drop not null';
        case 'SetType': return `type ${dataType(change.type)}`;
        case 'SetDefault': return `set default ${expression(change.value)}`;
        case 'DropDefault': return 'drop default';
    }
}

function column(definition: ColumnDefinition): string {
    return [name(definition.name), dataType(definition.type), ...definition.constraints.map(columnConstraint)].join(' ');
}

function columnConstraint(node: ColumnConstraint): string {
    switch (node.$type) {
        case 'NotNull': return 'not null';
        case 'DefaultValue': return `default ${expression(node.value)}`;
        case 'ColumnCheck': return `check (${expression(node.condition)})`;
        case 'ColumnReferences': return `references ${name(node.table)}${node.column ? ` (${name(node.column)})` : ''}`;
        case 'ColumnPrimaryKey': return 'primary key';
        case 'ColumnUnique': return 'unique';
    }
}

function constraint(node: TableConstraint): string {
    return (node.name ? `constraint ${name(node.name)} ` : '') + constraintRule(node.rule);
}

function constraintRule(rule: ConstraintRule): string {
    switch (rule.$type) {
        case 'PrimaryKey': return `primary key (${names(rule.columns)})`;
        case 'Unique': return `unique (${names(rule.columns)})`;
        case 'Check': return `check (${expression(rule.condition)})`;
        case 'ForeignKey': return `foreign key (${names(rule.columns)}) references ${name(rule.table)}` +
            (rule.referenced.length > 0 ? ` (${names(rule.referenced)})` : '');
    }
}
