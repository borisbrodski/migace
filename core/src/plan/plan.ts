/**
 * The plan of a migration: every snippet of a project with its parts, the statements of every part
 * and what the script has to know to run them. A plan is plain data. It is made for one database;
 * the script of that database is one way to write it down.
 */
export interface Plan {
    /** The prefix of the names of the ledger tables. */
    ledgerPrefix: string;
    /** The fingerprint of the schema that the application expects. Stored in the ledger after a complete run. */
    fingerprint?: string;
    /** In the order in which they run. */
    snippets: PlanSnippet[];
}

export interface PlanSnippet {
    /** The identity of the snippet. The ledger knows a snippet by it. */
    uid: string;
    name: string;
    /** The name without date and time. */
    slug: string;
    /** The reason why the snippet never runs again, if it is retired. */
    retired?: string;
    /** The condition of the whole snippet. */
    when?: PlanCondition;
    parts: PlanPart[];
}

export interface PlanPart {
    name: string;
    /** The checksum of the part as the author wrote it, with the version of its rule: `v1:…`. */
    checksum: string;
    when?: PlanCondition;
    verifyBefore: PlanCondition[];
    verifyAfter: PlanCondition[];
    /** The message of a part that stops the run. Such a part has no steps. */
    stop?: string;
    /** The statements of the part. A statement under `do` is one step; an action can have several. */
    steps: PlanStep[];
}

export interface PlanStep {
    sql: string;
    /** Set for a statement that the database refuses inside a transaction. */
    outsideTransaction: boolean;
    /** For a statement outside a transaction: what removes the rest of a failed attempt before the step is repeated. */
    cleanup?: string;
}

export interface PlanCondition {
    /** An expression of the database that is true or false. */
    sql: string;
    /** The condition as the author wrote it, for messages. */
    text: string;
}
