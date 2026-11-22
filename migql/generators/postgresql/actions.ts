import { asBoolean, asName, asNames, asType, actionName, parameter, type TypeSpec } from '../../src/actions/parameters.js';
import type { ActionEntry, Expression } from '../../src/generated/ast.js';
import { expression, knownTypeOf, typeName, typeText } from './expressions.js';
import { name, text } from './names.js';
import { names, NotGeneratedYet, type Step } from './statements.js';

/**
 * The PostgreSQL statements of an action. An action says what the result is; this file chooses
 * the statements, and it chooses them so that no statement holds a strong lock for long.
 */
export function action(entry: ActionEntry): Step[] {
    const named = (parameterName: string) => asName(parameter(entry, parameterName))!;
    const table = named('table');
    switch (actionName(entry)) {
        case 'column-set-not-null': return setNotNull(table, named('column'));
        case 'column-rename': return [{ sql: `alter table ${name(table)} rename column ${name(named('from'))} to ${name(named('to'))}` }];
        case 'column-ensure': return [{
            sql: ensureColumn(table, named('column'), asType(parameter(entry, 'type'))!, parameter(entry, 'default'), asBoolean(parameter(entry, 'not-null')) ?? false),
        }];
        case 'constraint-add-check':
            return validatedLater(table, named('name'), `check (${expression(parameter(entry, 'check')!)})`);
        case 'constraint-add-foreign-key': {
            const referenced = asNames(parameter(entry, 'referenced-columns'));
            return validatedLater(table, named('name'),
                `foreign key (${names(asNames(parameter(entry, 'columns'))!)}) references ${name(named('references'))}` +
                (referenced ? ` (${names(referenced)})` : ''));
        }
        default: throw new Error(`The action "${actionName(entry)}" has no generator for PostgreSQL.`);
    }
}

/**
 * A new constraint is checked against all rows. Added as "not valid" it takes its strong lock only briefly;
 * the validation that follows reads the rows under a lock that lets everybody read and write.
 */
function validatedLater(table: string, constraint: string, rule: string): Step[] {
    return [
        { sql: `alter table ${name(table)} add constraint ${name(constraint)} ${rule} not valid` },
        { sql: `alter table ${name(table)} validate constraint ${name(constraint)}` },
    ];
}

/**
 * `set not null` alone reads the whole table while it holds a lock that blocks everybody.
 * With a validated check constraint in place, PostgreSQL skips that scan.
 */
function setNotNull(table: string, columnName: string): Step[] {
    const alter = `alter table ${name(table)}`;
    const check = name(`${table}_${columnName}_not_null`);
    return [
        { sql: `${alter} add constraint ${check} check (${name(columnName)} is not null) not valid` },
        { sql: `${alter} validate constraint ${check}` },
        { sql: `${alter} alter column ${name(columnName)} set not null` },
        { sql: `${alter} drop constraint ${check}` },
    ];
}

/** The details of these types are a length. A column of such a type can be made longer. */
const WITH_LENGTH = new Set(['varchar', 'char']);

/**
 * Whether the column exists cannot be known when the script is built: the database that runs it decides.
 * The decision is therefore made by code that runs in the database.
 */
function ensureColumn(table: string, columnName: string, type: TypeSpec, defaultValue: Expression | undefined, notNull: boolean): string {
    const wanted = `${table}.${columnName} ${typeText(type)}`;
    const isType = `existing.atttypid = ${text(typeName(type))}::regtype`;
    const widen = widerThan(type);
    const definition = `${name(columnName)} ${typeText(type)}` + (defaultValue ? ` default ${expression(defaultValue)}` : '') + (notNull ? ' not null' : '');
    const body = [
        'declare',
        '    existing record;',
        'begin',
        '    select a.atttypid, a.atttypmod, format_type(a.atttypid, a.atttypmod) as type into existing',
        '    from pg_attribute a',
        `    where a.attrelid = ${text(name(table))}::regclass and a.attname = ${text(columnName)} and a.attnum > 0 and not a.attisdropped;`,
        '    if not found then',
        `        alter table ${name(table)} add column ${definition};`,
        `    elsif ${isType} and existing.atttypmod = ${typeModifier(type)} then`,
        '        null;',
        ...(widen ? [
            `    elsif ${isType} and ${widen} then`,
            `        alter table ${name(table)} alter column ${name(columnName)} type ${typeText(type)};`,
        ] : []),
        '    else',
        // A percent sign in a name would be taken for a place to fill in, so it is doubled.
        `        raise exception ${text(`column-ensure ${wanted.replace(/%/g, '%%')}: the column exists as %. It can neither be kept nor widened.`)}, existing.type;`,
        '    end if;',
        'end',
    ].join('\n');
    const quote = dollarQuote(body);
    return `do ${quote}\n${body}\n${quote}`;
}

/** A delimiter for the code that the code itself does not contain, so that no name inside it can end the code. */
function dollarQuote(body: string): string {
    for (let number = 0; ; number++) {
        const quote = `$ensure${number === 0 ? '' : number}$`;
        if (!body.includes(quote)) {
            return quote;
        }
    }
}

/**
 * The number in which PostgreSQL stores the details of a type: the length plus 4, precision and scale
 * packed into one number plus 4, or -1 without details.
 */
function typeModifier(type: TypeSpec): number {
    const known = knownTypeOf(type);
    if (type.parameters.length === 0) {
        return -1;
    }
    if (known && WITH_LENGTH.has(known) && type.parameters.length === 1) {
        return type.parameters[0] + 4;
    }
    if (known === 'numeric') {
        return ((type.parameters[0] << 16) | (type.parameters[1] ?? 0)) + 4;
    }
    throw new NotGeneratedYet(`"column-ensure" knows the details of varchar, char and numeric only, not of ${typeText(type)}.`);
}

/** The condition under which an existing column of the same type is narrower than the wanted one, if the type can be widened. */
function widerThan(type: TypeSpec): string | undefined {
    const known = knownTypeOf(type);
    if (known && WITH_LENGTH.has(known) && type.parameters.length === 1) {
        return `existing.atttypmod between 5 and ${type.parameters[0] + 3}`;
    }
    if (known === 'numeric' && type.parameters.length > 0) {
        const [precision, scale = 0] = type.parameters;
        // A larger precision with the same scale keeps every stored value as it is.
        return `existing.atttypmod <> -1 and (existing.atttypmod - 4) & 65535 = ${scale} and (existing.atttypmod - 4) >> 16 < ${precision}`;
    }
    return undefined;
}
