grammar Migql

// ---------------------------------------------------------------------------------------------
// The envelope: the keys of a snippet file.
//
// Every key is an entry of its own. A key that appears twice or is missing is found by the
// validator, which can say more than a parser error can.
// ---------------------------------------------------------------------------------------------

entry Snippet:
    entries+=SnippetEntry*;

SnippetEntry:
    NameEntry | UidEntry | DocEntry | WhenEntry | LetEntry | PartsEntry | TestdataEntry
    | ChangedEntry | RetiredEntry | RequiresDowntimeEntry;

NameEntry:
    kind=(
        /** The name of the snippet: `YYYYMMDD-HHMM-slug`. Snippets run in the order of their names. */
        'migration:'
        | /** The name of a repair snippet. It corrects what an earlier snippet did, where a condition says so. */
          'repair:'
    ) name=WORD EOL;

UidEntry:
    /** The identity of the snippet. It is created once and never changes; the database remembers the snippet by it. */
    'uid:' value=WORD EOL;

DocEntry:
    /** One sentence that says what the snippet is for. */
    'doc:' text=TEXT EOL;

ChangedEntry:
    /** The reason for an intended change to a released snippet. Without it the build rejects the change. */
    'changed:' reason=TEXT EOL;

RetiredEntry:
    /** The snippet never runs again. Databases that ran it keep their record. */
    'retired:' reason=TEXT EOL;

RequiresDowntimeEntry:
    /** The snippet may only run while the application is stopped. */
    'requires-downtime:' value=WORD EOL;

WhenEntry:
    /** Runs the snippet or the part only if the condition is true. Otherwise it is skipped and looked at again on the next run. */
    'when:' condition=Expression EOL;

LetEntry:
    /** Names for conditions that are used more than once. */
    'let:' INDENT definitions+=LetDefinition+ DEDENT;

LetDefinition:
    name=NAME ':' condition=Expression EOL;

PartsEntry:
    /** The steps of the snippet, in the order in which they run. Every part has a name and one operation. */
    'parts:' INDENT parts+=Part+ DEDENT;

Part:
    DASH name=NAME ':' (INDENT entries+=PartEntry+ DEDENT)?;

PartEntry:
    DoEntry | InsertEntry | NativeEntry | StopEntry
    | WhenEntry | VerifyEntry | BatchEntry | ExpectRowsEntry | PhaseEntry | TodoEntry;

DoEntry:
    /** One statement in the statement language. It is checked and then translated for the database. */
    'do:' statement=Statement EOL;

InsertEntry:
    /** Inserts rows, written as YAML: `into`, and `values` for one row or `rows` for several. */
    'insert:' INDENT entries+=InsertSpecEntry+ DEDENT;

InsertSpecEntry:
    IntoEntry | ValuesEntry | RowsEntry;

ValuesEntry:
    'values:' INDENT values+=ColumnValue+ DEDENT;

RowsEntry:
    'rows:' INDENT rows+=InsertRow+ DEDENT;

InsertRow:
    DASH map=FlowMap EOL;

/** A column and its value on a line of its own. */
ColumnValue:
    column=NAME ':' value=Expression EOL;

/** Columns and values on one line: `{ id: 1, code: 'OPEN' }`. */
FlowMap:
    {infer FlowMap} '{' (values+=FlowValue (',' values+=FlowValue)*)? '}';

FlowValue infers ColumnValue:
    column=Name ':' value=Expression;

IntoEntry:
    'into:' table=Name EOL;

NativeEntry:
    /** SQL in the dialect of one database, one entry per database. It is sent as it is. */
    'native:' INDENT variants+=NativeVariant+ DEDENT;

NativeVariant:
    dialect=NAME ':' sql=TEXT EOL;

StopEntry:
    /** Ends the run with a message for a person, for a case that cannot be repaired automatically. */
    'stop:' message=TEXT EOL;

VerifyEntry:
    kind=(
        /** Fails the part before it runs if the condition is not true. Nothing is changed then. */
        'verify-before:'
        | /** Fails the part after it ran if the condition is not true. Its change is undone. */
          'verify-after:'
    ) (condition=Expression EOL | INDENT checks+=QuantifierCheck+ DEDENT);

QuantifierCheck:
    DASH quantifier=('all:' | 'none:' | 'exists:' | 'single:') condition=Expression EOL;

BatchEntry:
    /** Runs a data statement in portions and saves after each: `20000 by id`. An interrupted run continues with the next portion. */
    'batch:' size=INT 'by' column=Name EOL;

ExpectRowsEntry:
    /** How many rows the statement may change: `0..50`. Outside this range the part fails and nothing is changed. */
    'expect-rows:' min=INT ('..' max=INT)? EOL;

PhaseEntry:
    /** `finish` marks a part that breaks older application versions. It runs only when no older version is left. */
    'phase:' phase=WORD EOL;

TodoEntry:
    /** An open decision. The migration script cannot be built while a todo is left. */
    'todo:' text=TEXT EOL;

TestdataEntry:
    kind=(
        /** Rows that the proof inserts after the snippet ran, so that later snippets work on filled tables. */
        'testdata:'
        | /** Rows that the proof inserts before the snippet runs, in the old shape of the tables. */
          'testdata-before:'
    ) INDENT rows+=TestRow+ DEDENT;

TestRow:
    DASH entries+=TestRowEntry+;

TestRowEntry:
    TableEntry | AsEntry | FillEntry | RowEntry;

AsEntry:
    'as:' name=Name EOL;

FillEntry:
    'fill:' mode=WORD EOL;

RowEntry:
    'row:' (map=FlowMap EOL | INDENT values+=ColumnValue+ DEDENT);

TableEntry:
    'table:' table=Name EOL;

// ---------------------------------------------------------------------------------------------
// The statement language.
// ---------------------------------------------------------------------------------------------

Statement:
    CreateTable | AlterTable | CreateIndex | DropTable | DropIndex | EnsureColumn | RenameColumn
    | Update | Delete | Insert;

CreateTable:
    'create' 'table' name=Name '(' elements+=TableElement (',' elements+=TableElement)* ')';

TableElement:
    TableConstraint | ColumnDefinition;

ColumnDefinition:
    name=Name type=DataType constraints+=ColumnConstraint*;

ColumnConstraint:
    {infer NotNull} 'not' 'null'
    | {infer DefaultValue} 'default' value=Additive
    | {infer ColumnCheck} 'check' '(' condition=Expression ')'
    | {infer ColumnReferences} 'references' table=Name ('(' column=Name ')')?
    | {infer ColumnPrimaryKey} 'primary' 'key'
    | {infer ColumnUnique} 'unique';

TableConstraint:
    ('constraint' name=Name)? rule=ConstraintRule;

ConstraintRule:
    {infer PrimaryKey} 'primary' 'key' '(' columns+=Name (',' columns+=Name)* ')'
    | {infer Unique} 'unique' '(' columns+=Name (',' columns+=Name)* ')'
    | {infer Check} 'check' '(' condition=Expression ')'
    | {infer ForeignKey} 'foreign' 'key' '(' columns+=Name (',' columns+=Name)* ')'
        'references' table=Name ('(' referenced+=Name (',' referenced+=Name)* ')')?;

AlterTable:
    'alter' 'table' table=Name action=AlterAction;

// The alternatives are written so that one token decides between them.
// The parser then reports an error at the wrong token and not at the start of the action.
AlterAction:
    'add' ({infer AddColumn} 'column' column=ColumnDefinition | {infer AddConstraint} constraint=TableConstraint)
    | 'drop' {infer DropColumn} 'column' column=Name
    | 'alter' {infer AlterColumn} 'column' column=Name change=ColumnChange;

ColumnChange:
    'set' ({infer SetNotNull} 'not' 'null' | {infer SetType} 'data' 'type' type=DataType | {infer SetDefault} 'default' value=Additive)
    | 'drop' ({infer DropNotNull} 'not' 'null' | {infer DropDefault} 'default')
    | {infer SetType} 'type' type=DataType;

CreateIndex:
    'create' unique?='unique'? 'index' concurrently?='concurrently'? name=Name
    'on' table=Name '(' columns+=Name (',' columns+=Name)* ')';

DropTable:
    'drop' 'table' name=Name;

DropIndex:
    'drop' 'index' concurrently?='concurrently'? name=Name;

EnsureColumn:
    'ensure' 'column' table=Name '.' column=ColumnDefinition;

RenameColumn:
    'rename' 'column' table=Name '.' column=Name 'to' newName=Name;

Delete:
    'delete' 'from' table=Name alias=Name? ('where' condition=Expression)?;

Insert:
    'insert' 'into' table=Name '(' columns+=Name (',' columns+=Name)* ')'
    ('values' '(' values+=Expression (',' values+=Expression)* ')' | query=Select);

Update:
    'update' table=Name alias=Name? 'set' assignments+=Assignment (',' assignments+=Assignment)*
    ('where' condition=Expression)?;

Assignment:
    column=Name '=' value=Expression;

Select:
    'select' items+=Expression (',' items+=Expression)*
    'from' table=Name alias=Name?
    ('where' condition=Expression)?;

// ---------------------------------------------------------------------------------------------
// Expressions, from the weakest binding to the strongest.
// ---------------------------------------------------------------------------------------------

Expression:
    OrExpression;

OrExpression infers Expression:
    AndExpression ({infer BinaryExpression.left=current} operator='or' right=AndExpression)*;

AndExpression infers Expression:
    NotExpression ({infer BinaryExpression.left=current} operator='and' right=NotExpression)*;

NotExpression infers Expression:
    {infer NotExpression} 'not' operand=NotExpression
    | Predicate;

Predicate infers Expression:
    Additive (
        {infer BinaryExpression.left=current} operator=('=' | '<>' | '<=' | '>=' | '<' | '>') right=Additive
      | {infer IsNullExpression.operand=current} 'is' negated?='not'? 'null'
      | {infer InExpression.operand=current} negated?='not'? 'in'
            '(' (query=Select | values+=Expression (',' values+=Expression)*) ')'
      | {infer BetweenExpression.operand=current} negated?='not'? 'between' low=Additive 'and' high=Additive
      | {infer LikeExpression.operand=current} negated?='not'? 'like' pattern=Additive
    )?;

Additive infers Expression:
    Multiplicative ({infer BinaryExpression.left=current} operator=('+' | '-' | '||') right=Multiplicative)*;

Multiplicative infers Expression:
    Unary ({infer BinaryExpression.left=current} operator=('*' | '/') right=Unary)*;

Unary infers Expression:
    {infer NegativeExpression} '-' operand=Unary
    | Primary;

Primary infers Expression:
    {infer SubqueryExpression} '(' query=Select ')'
    | {infer ParenExpression} '(' expression=Expression ')'
    | {infer ExistsExpression} 'exists' '(' query=Select ')'
    | CaseExpression
    | {infer CastExpression} 'cast' '(' expression=Expression 'as' type=DataType ')'
    | {infer NextValueExpression} 'next' 'value' 'for' sequence=Name
    | Literal
    | {infer Placeholder} '?'
    | StateCondition
    | RanCondition
    | FunctionCall
    | {infer ColumnRef} table=Name '.' column=Name
    | NameRef;

/** A question about the schema of the database as it is now. */
StateCondition infers Expression:
    {infer ColumnExists} 'column' table=Name '.' column=Name 'exists'
    | {infer TableExists} 'table' table=Name 'exists'
    | {infer IndexExists} 'index' index=Name 'exists';

/** A question about the history of the database: did this part run, and in which version? */
RanCondition:
    'ran' part=[Part:PART_REF] ('from' release=RELEASE)?;

CaseExpression:
    'case' subject=Expression? branches+=CaseBranch+ ('else' otherwise=Expression)? 'end';

CaseBranch:
    'when' condition=Expression 'then' result=Expression;

FunctionCall:
    name=Name '(' (star?='*' | arguments+=Expression (',' arguments+=Expression)*)? ')';

/**
 * A name that stands alone. In a condition it is a name defined under `let`.
 * Inside a statement or a subquery it is a column of the table in use.
 */
NameRef:
    target=[LetDefinition:Name];

Literal infers Expression:
    {infer StringLiteral} value=STRING
    | {infer NumberLiteral} value=(DECIMAL | INT)
    | {infer DateLiteral} 'date' value=STRING
    | {infer NullLiteral} 'null'
    | {infer BooleanLiteral} (value?='true' | 'false');

DataType:
    name=Name ('(' parameters+=INT (',' parameters+=INT)* ')')?;

/** A name of a table, a column or another object. Some keywords are accepted as names. */
Name returns string:
    ID | 'value' | 'key' | 'date' | 'type' | 'data' | 'next';

// Tokens of the envelope. The MigQL lexer produces them; the patterns are never used.
terminal INDENT: 'synthetic:indent';
terminal DEDENT: 'synthetic:dedent';
terminal EOL: 'synthetic:eol';
terminal DASH: 'synthetic:dash';
terminal NAME: 'synthetic:name';
terminal WORD: 'synthetic:word';
terminal TEXT: 'synthetic:text';

// Tokens of the statement language.
// PART_REF is only read after `ran`, RELEASE only after `ran … from`. See MigqlTokenBuilder.
terminal PART_REF: /[A-Za-z0-9][\w-]*\.[A-Za-z0-9][\w-]*/;
terminal RELEASE: /[A-Za-z0-9][\w.+-]*/;
hidden terminal WS: /[ \t\r\n]+/;
hidden terminal SQL_COMMENT: /--[^\n\r]*/;
terminal DECIMAL returns number: /[0-9]+\.[0-9]+/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /'(?:[^']|'')*'/;
terminal ID: /[_a-zA-Z][\w_]*/;
