---
type: journal
date: 2026-11-21
milestones: [M0, M1]
---

# Workspace and MigQL parser: first implementation session

This note covers M1-AC-32 and M1-AC-33. It also lists every choice that was made where the specs leave a detail open.

## What exists now

- A workspace of npm packages: `migql/` with code, `core/` as a placeholder. Node is fixed to 22.22.2 with Volta, and `engine-strict` rejects an older Node at `npm install`.
- `migql/`: grammar, lexer, linking, checks, hover, completion, two quick fixes, and a first PostgreSQL generator.
- The catalogue `migql/constructs/` with 14 constructs. Each has `construct.md`, valid examples, invalid examples and the expected PostgreSQL.
- 515 tests pass and 2 are skipped (see question 24). They run in about 4 seconds. No test needs Docker or a database.

## Can one Langium grammar carry the envelope and the statements?

Yes. Open question 9 is closed.

The parser, the linker, the checks and the language server of Langium are used as they are. Only the lexer is replaced. The grammar is one file of 360 lines. The lexer and its table are about 550 lines.

### Literal blocks

- A general lexer cannot read them, because the end of a block is given by indentation and the content is indented freely.
- `migql/src/lexer/migql-lexer.ts` reads the file line by line. For `key: |` it collects the following lines that are indented deeper than the key.
- The collected text is handed to a normal Chevrotain lexer for the statement language. The tokens are then moved to their place in the file.
- A statement on one line and the same statement in a block give the same tokens. So they give the same syntax tree (M1-AC-12).
- An error inside a block has its real line and column (M1-AC-28).

### Values that depend on their key

- The lexer has a small table, `migql/src/lexer/envelope-schema.ts`. It says for every key how its value is read: as one word (`migration`, `uid`), as free text (`doc`, `stop`, `native`), or as tokens of the statement language (`do`, `when`).
- The table also says which keys may follow below a key. An unknown key is therefore found by the lexer, which reports it with the list of allowed keys.
- A key and its colon are one token, for example `do:`. The same word inside a statement is another token. A column may therefore be called `doc`, `batch` or `parts`.
- Limit: the table repeats a part of the structure that the grammar also describes. A new key has to be added in both places. A test fails if one is forgotten, because the key is then unknown or its value cannot be parsed.

### Tokens of the envelope

The lexer produces `INDENT`, `DEDENT`, `DASH` and `EOL` (the end of a value). The grammar uses them like ordinary terminals.

`EOL` is the reason why error recovery works well: every value ends with a token that the parser can use to find its way back.

### Error recovery

- A syntax error in one part does not hide an error in a later part (M1-AC-27). No extra code was needed for this.
- Limit: after an error Chevrotain sometimes inserts or drops one token and continues. That can produce a second error in the same statement. Example: `insert into t values (1)` without a column list reports the missing bracket and then three wrong names.
- Chevrotain's messages list token sequences. `migql/src/parser/migql-parser-error-message-provider.ts` replaces them with sentences such as `Expected "from", but found "form".`

### Two tokens that depend on their place

`ran order-status.link-status from 1.2.0` contains a name with dashes and a release with dots. Everywhere else a dash is a minus and `1.2` is a number. `migql/src/lexer/migql-token-builder.ts` makes two tokens that match only after `ran` and after `ran … from`.

### Completion

Langium asks the lexer for the tokens of the text up to the cursor. The lexer has a mode for this: it does not close the value and the blocks that are still being typed. With that, completion of keys, keywords, `let` names and parts works without a completion provider of our own.

## Time to parse (M1-AC-33)

A snippet of 500 lines (22,731 characters, 5,468 tokens), median of 30 runs on a developer laptop:

| Step | Time |
|---|---|
| Lexer | 2.0 ms |
| Lexer and parser | 11.4 ms |

The thousand random changes of M1-AC-31 take 0.25 seconds together.

One finding on the way: a token with a pattern function switches off an optimisation of Chevrotain for the whole lexer, unless the token says with which characters it can start. Without that hint the lexer took 12 ms instead of 2 ms.

## Findings about Langium

1. **File ending.** Langium finds the language of a file by its last extension. For `x.migql.yaml` that is `.yaml`. `migql/src/migql-service-registry.ts` compares the whole ending instead. This does not answer open question 8, which is about the editors.
2. **Place of an error.** Where several alternatives start with the same token, the parser reports the error at the first token of the alternatives and not at the wrong one. `alter table t add x` was reported at `add`. The grammar now lets one token decide: `'add' ('column' … | constraint)`. Rule for new grammar: write alternatives so that their first tokens differ.
3. **Names in conditions.** A name that stands alone is a `let` name in a condition and a column inside a statement or a subquery. Both are the same grammar rule. The linker links the first kind and leaves the second alone (`migql/src/references/names.ts`).
4. **Explanations of keys.** A comment in front of a keyword in the grammar is shown by the editor when the mouse is over that key. No code is needed.

## Findings about langium-tools 0.4.0

1. `getDocumentIssues` lists a lexer or parser problem twice after validation: once without its end, once as a diagnostic with its range. The tests use `{ ignoreLexerErrors: true, ignoreParserErrors: true }` and check the diagnostic.
2. `langiumGeneratorSuite` with named targets still expects the default target: an empty folder `generated/DEFAULT/` and a file `DEFAULT-metadata.json`. Git does not keep an empty folder, so the test fails in a fresh clone. The catalogue therefore uses the default target and writes into `generated/postgresql/`. The list of files is `generated-metadata.json`, not `postgresql-metadata.json`.
3. The title of a snapshot test ends with "(generating)" in the comparing run too.
4. The invalid examples stay away from the snapshot runner with `initWorkspace: … path.join(construct, 'dsls')`. This settles point 3 of the langium-tools note.
5. `tools/with-env.mjs` sets `GENERATOR_TEST=generate` without a shell feature. It was run on Linux only.
6. The catalogue test (`migql/test/constructs/catalogue.test.ts`) is the folder-driven suite for valid and invalid examples that the langium-tools note asks for. It is a candidate to move there.

## Choices where the specs leave a detail open

Each of these is the least surprising option. Each can be changed.

| Topic | Choice | Question |
|---|---|---|
| A comment after a one-line statement | `do: delete from t # why` is accepted, as YAML reads it. It is an error only if the `#` is inside a text in quotes. M1-AC-14 can be read stricter. | 27 |
| A one-line value that is one text in quotes | `code: 'OPEN'` is accepted, because YAML and MigQL mean the same. `'a' \|\| 'b'` is an error. | – |
| A word without a colon | It becomes a name token, so the parser lists the keys that fit and the editor can complete it. | – |
| `?` in a statement | Accepted if the part has a `todo`. The website shows it; the vault did not define it. | 28 |
| `any` and `maria.id` in test rows | Parsed as names. Their meaning is not checked. | 4 |
| `ran … from <release>` | Implemented. The form with `sha256:` from the architecture note is not. | 5 |
| Constructs with several steps | `ensure column` and `rename column` parse. The generator writes "not generated yet" for them. | – |
| Functions | Every name followed by brackets is a function call. `days(n)` becomes `make_interval(days => n)`. No list of allowed functions yet. | open point of M1 |
| Quoted names | Not supported. | open point of M1 |

## Not done

- **M0-AC-06:** the workflow runs on Linux only. Windows was left out on purpose in this session.
- **M0-AC-04:** `npm run test:generate` was run on Linux only.
- **M1-AC-08:** `upsert` is not implemented. No note defines how it is written. Question 25.
- The keys `former-names`, `before` and `after` are not implemented. No note defines their values. Question 26.
- The two website examples with `expand column` and `contract column` are skipped. The vault defines `rename column` instead. Question 24.
- Slugs are not checked for uniqueness yet. The decision asks for it; it needs all snippets of a project and belongs to the build.
- The file `schema.json` and formatting are non-goals of M1.

## Proposed changes to the syntax

The target syntax can be implemented well. These points would make it simpler or remove a difference to YAML. None of them is decided.

1. **Flow maps hold simple values only.** YAML splits `{ a: coalesce(x, 1) }` at the comma inside the brackets, and it rejects `{ a: 'x' || 'y' }`. MigQL parses the first one today, so the two parsers disagree. Proposal: in a flow map a value is a literal, a name or `table.column`. Anything else is written in the block form of `row:` and `values:`.
2. **Free text is never quoted.** `doc: 'A text'` is read by YAML without the quotes and by MigQL with them. Proposal: a text value that starts with a quote is an error with the advice to remove the quotes or to use a block.
3. **Quoted names with double quotes.** 56 words are keywords of the statement language and cannot name a column, for example `check`, `default`, `index` and `table`. Six frequent ones (`value`, `key`, `date`, `type`, `data`, `next`) are accepted as names already. Proposal: `"index"` as in SQL. A one-line value cannot start with it; that case needs a block.
4. **Lists at the indentation of their key.** YAML allows `parts:` followed by `- name:` in the same column. MigQL needs the list to be indented. Proposal: keep it that way and give a clear message, or support it. Today the message is poor.
5. **`fill`, `phase` and `requires-downtime` take fixed words.** They could be keywords in the grammar instead of free words checked later. The editor would then offer `all`, `required`, `finish`, `true` and `false`. This changes no snippet.
6. **One spelling for a change of type.** The grammar accepts `alter column c type t` and `alter column c set data type t`. The first is PostgreSQL, the second is standard SQL. Proposal: decide for one; the website uses the first.
