import type {
    AlterTable, ColumnChange, ColumnConstraint, ColumnDefinition, ConstraintRule, Expression, Statement, TableConstraint,
} from '../../src/generated/ast.js';
import { dataType, expression, select } from './expressions.js';
import { name } from './names.js';

/** A construct that the generator does not translate yet. */
export class NotGeneratedYet extends Error { }

/** One PostgreSQL statement, without the semicolon at its end. */
export interface Step {
    sql: string;
    /** Set for a statement that PostgreSQL refuses inside a transaction, such as `create index concurrently`. */
    outsideTransaction?: boolean;
}

/**
 * The PostgreSQL statement for one statement of the statement language.
 * `do` runs what was written: one statement in, one statement out, and nothing added.
 */
export function statement(node: Statement): Step {
    switch (node.$type) {
        case 'CreateTable': return {
            sql: [
                `create table ${name(node.name)} (`,
                node.elements.map(element => '    ' + (element.$type === 'ColumnDefinition' ? column(element) : constraint(element))).join(',\n'),
                ')',
            ].join('\n'),
        };
        case 'AlterTable': return { sql: `alter table ${name(node.table)} ${alterAction(node.action)}` };
        case 'CreateIndex': return {
            sql: `create ${node.unique ? 'unique ' : ''}index ${node.concurrently ? 'concurrently ' : ''}` +
                `${name(node.name)} on ${name(node.table)} (${names(node.columns)})`,
            outsideTransaction: node.concurrently,
        };
        case 'DropTable': return { sql: `drop table ${name(node.name)}` };
        case 'DropIndex': return {
            sql: `drop index ${node.concurrently ? 'concurrently ' : ''}${name(node.name)}`,
            outsideTransaction: node.concurrently,
        };
        case 'Update': return {
            sql: `update ${name(node.table)}${alias(node.alias)} set ` +
                node.assignments.map(assignment => `${name(assignment.column)} = ${expression(assignment.value)}`).join(', ') +
                where(node.condition),
        };
        case 'Delete': return { sql: `delete from ${name(node.table)}${alias(node.alias)}${where(node.condition)}` };
        case 'Insert': return {
            sql: `insert into ${name(node.table)} (${names(node.columns)}) ` +
                (node.query ? select(node.query) : `values (${node.values.map(expression).join(', ')})`),
        };
        case 'RemovedEnsureColumn':
        case 'RemovedRenameColumn':
            throw new Error('This statement became an action and cannot be generated.');
    }
}

function alterAction(action: AlterTable['action']): string {
    switch (action.$type) {
        case 'AddColumn': return `add column ${column(action.column)}`;
        case 'AddConstraint': return `add ${constraint(action.constraint)}`;
        case 'DropColumn': return `drop column ${name(action.column)}`;
        case 'AlterColumn': return `alter column ${name(action.column)} ${columnChange(action.change)}`;
        case 'RenameColumn': return `rename column ${name(action.column)} to ${name(action.newName)}`;
    }
}

export function names(written: string[]): string {
    return written.map(name).join(', ');
}

function alias(written: string | undefined): string {
    return written ? ` ${name(written)}` : '';
}

function where(condition: Expression | undefined): string {
    return condition ? ` where ${expression(condition)}` : '';
}

function columnChange(change: ColumnChange): string {
    switch (change.$type) {
        case 'SetNotNull': return 'set not null';
        case 'DropNotNull': return 'drop not null';
        case 'SetType': return `type ${dataType(change.type)}`;
        case 'SetDefault': return `set default ${expression(change.value)}`;
        case 'DropDefault': return 'drop default';
    }
}

export function column(definition: ColumnDefinition): string {
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
