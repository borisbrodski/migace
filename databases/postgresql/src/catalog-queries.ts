/**
 * The queries that read the PostgreSQL catalog. Each takes the name of the schema as `$1`.
 *
 * Lists are returned as JSON text, so the reader works with every driver.
 * Objects that an extension created are left out: they belong to the extension.
 */

const IN_SCHEMA = 'n.nspname = $1';

const notFromExtension = (catalog: string, oid: string) =>
    `not exists (select 1 from pg_depend d where d.classid = '${catalog}'::regclass and d.objid = ${oid} and d.deptype = 'e')`;

const columnNames = (numbers: string, table: string) => `(
    select json_agg(a.attname order by k.position)::text
    from unnest(${numbers}) with ordinality as k(number, position)
    join pg_attribute a on a.attrelid = ${table} and a.attnum = k.number)`;

export const TABLES = `
    select c.relname as name, obj_description(c.oid, 'pg_class') as comment
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where ${IN_SCHEMA} and c.relkind in ('r', 'p')
    order by c.relname`;

export const COLUMNS = `
    select c.relname as "table", a.attname as name,
           format_type(a.atttypid, a.atttypmod) as type,
           not a.attnotnull as nullable,
           pg_get_expr(d.adbin, d.adrelid) as "default",
           a.attidentity as identity,
           col_description(c.oid, a.attnum) as comment
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where ${IN_SCHEMA} and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`;

export const CONSTRAINTS = `
    select c.relname as "table", con.conname as name, con.contype as kind,
           ${columnNames('con.conkey', 'con.conrelid')} as columns,
           target.relname as target,
           ${columnNames('con.confkey', 'con.confrelid')} as target_columns,
           con.confupdtype as on_update, con.confdeltype as on_delete,
           pg_get_expr(con.conbin, con.conrelid) as expression
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_class target on target.oid = con.confrelid
    where ${IN_SCHEMA} and con.contype in ('p', 'u', 'f', 'c')
    order by c.relname, con.conname`;

/** Indexes that the author created. The index behind a constraint belongs to the constraint. */
export const INDEXES = `
    select t.relname as "table", i.relname as name, x.indisunique as "unique", am.amname as method,
           pg_get_indexdef(x.indexrelid) as definition,
           pg_get_expr(x.indpred, x.indrelid) as condition
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_am am on am.oid = i.relam
    where ${IN_SCHEMA} and not exists (select 1 from pg_constraint con where con.conindid = x.indexrelid)
    order by t.relname, i.relname`;

/** Triggers that the author created. Triggers behind foreign keys are internal. */
export const TRIGGERS = `
    select c.relname as "table", t.tgname as name, t.tgtype::integer as type,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as function,
           pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where ${IN_SCHEMA} and not t.tgisinternal
    order by c.relname, t.tgname`;

/** Sequences of their own. The sequence behind an identity column belongs to the column. */
export const SEQUENCES = `
    select c.relname as name, format_type(s.seqtypid, null) as type,
           s.seqstart::text as start, s.seqincrement::text as increment,
           s.seqmin::text as min, s.seqmax::text as max, s.seqcache::text as cache, s.seqcycle as cycle
    from pg_sequence s
    join pg_class c on c.oid = s.seqrelid
    join pg_namespace n on n.oid = c.relnamespace
    where ${IN_SCHEMA}
      and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'i')
    order by c.relname`;

export const VIEWS = `
    select c.relname as name, pg_get_viewdef(c.oid, true) as definition, obj_description(c.oid, 'pg_class') as comment
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where ${IN_SCHEMA} and c.relkind = 'v' and ${notFromExtension('pg_class', 'c.oid')}
    order by c.relname`;

export const ROUTINES = `
    select p.proname as name, p.prokind as kind,
           pg_get_function_identity_arguments(p.oid) as arguments,
           pg_get_function_result(p.oid) as returns,
           l.lanname as language, p.prosrc as body,
           obj_description(p.oid, 'pg_proc') as comment
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where ${IN_SCHEMA} and p.prokind in ('f', 'p') and ${notFromExtension('pg_proc', 'p.oid')}
    order by p.proname, 3`;

export const ENUMS = `
    select t.typname as name,
           (select json_agg(e.enumlabel order by e.enumsortorder)::text from pg_enum e where e.enumtypid = t.oid) as labels
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where ${IN_SCHEMA} and t.typtype = 'e' and ${notFromExtension('pg_type', 't.oid')}
    order by t.typname`;

export const DOMAINS = `
    select t.typname as name, format_type(t.typbasetype, t.typtypmod) as type,
           not t.typnotnull as nullable, t.typdefault as "default",
           (select json_agg(json_build_object('name', con.conname, 'definition', pg_get_constraintdef(con.oid)) order by con.conname)::text
            from pg_constraint con where con.contypid = t.oid and con.contype = 'c') as checks
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where ${IN_SCHEMA} and t.typtype = 'd' and ${notFromExtension('pg_type', 't.oid')}
    order by t.typname`;

/** Extensions belong to the database, not to one schema. */
export const EXTENSIONS = `
    select e.extname as name from pg_extension e order by e.extname`;
