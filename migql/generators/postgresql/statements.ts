import type {
    AlterAction, ColumnChange, ColumnConstraint, ColumnDefinition, ConstraintRule, Statement, TableConstraint,
} from '../../src/generated/ast.js';
import { dataType, expression, select } from './expressions.js';

/** A construct that the generator does not translate yet. */
export class NotGeneratedYet extends Error { }

/** The PostgreSQL statement for one statement of the statement language, without the semicolon. */
export function statement(node: Statement): string {
    switch (node.$type) {
        case 'CreateTable': return [
            `create table ${node.name} (`,
            node.elements.map(element => '    ' + (element.$type === 'ColumnDefinition' ? column(element) : constraint(element))).join(',\n'),
            ')',
        ].join('\n');
        case 'AlterTable': return `alter table ${node.table} ${alterAction(node.action)}`;
        case 'CreateIndex': return `create ${node.unique ? 'unique ' : ''}index ${node.concurrently ? 'concurrently ' : ''}` +
            `${node.name} on ${node.table} (${node.columns.join(', ')})`;
        case 'DropTable': return `drop table ${node.name}`;
        case 'DropIndex': return `drop index ${node.concurrently ? 'concurrently ' : ''}${node.name}`;
        case 'Update': return `update ${node.table}${alias(node.alias)} set ` +
            node.assignments.map(assignment => `${assignment.column} = ${expression(assignment.value)}`).join(', ') +
            where(node.condition);
        case 'Delete': return `delete from ${node.table}${alias(node.alias)}${where(node.condition)}`;
        case 'Insert': return `insert into ${node.table} (${node.columns.join(', ')}) ` +
            (node.query ? select(node.query) : `values (${node.values.map(expression).join(', ')})`);
        case 'EnsureColumn': throw severalSteps('ensure column');
        case 'RenameColumn': throw severalSteps('rename column');
    }
}

function severalSteps(construct: string): NotGeneratedYet {
    return new NotGeneratedYet(`"${construct}" needs several steps. Its generation belongs to milestone M3.`);
}

function alias(name: string | undefined): string {
    return name ? ` ${name}` : '';
}

function where(condition: Parameters<typeof expression>[0] | undefined): string {
    return condition ? ` where ${expression(condition)}` : '';
}

function alterAction(action: AlterAction): string {
    switch (action.$type) {
        case 'AddColumn': return `add column ${column(action.column)}`;
        case 'AddConstraint': return `add ${constraint(action.constraint)}`;
        case 'DropColumn': return `drop column ${action.column}`;
        case 'AlterColumn': return `alter column ${action.column} ${columnChange(action.change)}`;
    }
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

function column(definition: ColumnDefinition): string {
    return [definition.name, dataType(definition.type), ...definition.constraints.map(columnConstraint)].join(' ');
}

function columnConstraint(node: ColumnConstraint): string {
    switch (node.$type) {
        case 'NotNull': return 'not null';
        case 'DefaultValue': return `default ${expression(node.value)}`;
        case 'ColumnCheck': return `check (${expression(node.condition)})`;
        case 'ColumnReferences': return `references ${node.table}${node.column ? ` (${node.column})` : ''}`;
        case 'ColumnPrimaryKey': return 'primary key';
        case 'ColumnUnique': return 'unique';
    }
}

function constraint(node: TableConstraint): string {
    return (node.name ? `constraint ${node.name} ` : '') + constraintRule(node.rule);
}

function constraintRule(rule: ConstraintRule): string {
    switch (rule.$type) {
        case 'PrimaryKey': return `primary key (${rule.columns.join(', ')})`;
        case 'Unique': return `unique (${rule.columns.join(', ')})`;
        case 'Check': return `check (${expression(rule.condition)})`;
        case 'ForeignKey': return `foreign key (${rule.columns.join(', ')}) references ${rule.table}` +
            (rule.referenced.length > 0 ? ` (${rule.referenced.join(', ')})` : '');
    }
}
