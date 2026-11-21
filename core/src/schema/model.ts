/**
 * The schema of a database as MIG-Ace sees it: only what the application depends on.
 * Owners, grants, tablespaces and storage settings are not part of it.
 *
 * Texts that the database stores in its own form (defaults, check expressions, view
 * definitions) are kept as the database returns them.
 */
export interface SchemaModel {
    tables: Table[];
    sequences: Sequence[];
    views: View[];
    /** Functions and procedures. */
    routines: Routine[];
    enums: EnumType[];
    domains: Domain[];
    extensions: Extension[];
}

export interface Table {
    name: string;
    comment?: string;
    /** The order of the columns has no meaning. */
    columns: Column[];
    primaryKey?: KeyConstraint;
    uniques: KeyConstraint[];
    foreignKeys: ForeignKey[];
    checks: CheckConstraint[];
    /** Indexes that the author created. The index behind a key belongs to the key and is not listed. */
    indexes: Index[];
    triggers: Trigger[];
}

export interface Column {
    name: string;
    /** The type without length or precision, for example `character varying`. */
    type: string;
    /** Length, or precision and scale, for example `100` or `12,2`. */
    typeDetails?: string;
    nullable: boolean;
    default?: string;
    /** Set for an identity column. Its sequence belongs to the column and is not listed. */
    identity?: 'always' | 'by default';
    comment?: string;
}

/** A primary key or a unique constraint. The order of the columns has a meaning. */
export interface KeyConstraint {
    name: string;
    columns: string[];
}

export interface ForeignKey {
    name: string;
    columns: string[];
    target: string;
    targetColumns: string[];
    onUpdate: string;
    onDelete: string;
}

export interface CheckConstraint {
    name: string;
    expression: string;
}

export interface Index {
    name: string;
    unique: boolean;
    /** The access method, for example `btree` or `gin`. */
    method: string;
    /** Column names or expressions, in the order of the index. */
    columns: string[];
    /** The condition of a partial index. */
    condition?: string;
}

export interface Trigger {
    name: string;
    timing: 'before' | 'after' | 'instead of';
    events: string[];
    level: 'row' | 'statement';
    function: string;
    condition?: string;
}

export interface Sequence {
    name: string;
    type: string;
    start: string;
    increment: string;
    min: string;
    max: string;
    cache: string;
    cycle: boolean;
}

export interface View {
    name: string;
    definition: string;
    comment?: string;
}

export interface Routine {
    kind: 'function' | 'procedure';
    name: string;
    /** The argument list that identifies the routine, for example `integer, text`. */
    arguments: string;
    returns?: string;
    language: string;
    body: string;
    comment?: string;
}

export interface EnumType {
    name: string;
    /** The order of the labels has a meaning. */
    labels: string[];
}

export interface Domain {
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
    checks: CheckConstraint[];
}

export interface Extension {
    name: string;
}

/** Reads the schema of a database into a model. Every supported database implements it. */
export interface SchemaReader {
    read(): Promise<SchemaModel>;
}
