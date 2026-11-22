---
type: glossary
status: mixed
---

# Glossary

| Term | Meaning |
|---|---|
| Desired state | The schema produced by running `schema/` on an empty database |
| Snippet | One migration file with ordered parts |
| Part | One operation inside a snippet, written by the author: one statement, or one block of native SQL. The unit that conditions and checks belong to |
| Step | One SQL statement that the generator produces for a part on one database. Most parts have one step. An author never writes steps |
| Baseline | An older database state with data and ledger, used as the start of the proof loop |
| Proof loop | The test that migrates a baseline and compares it with the desired state |
| Ledger | The tables that record every run, snippet and part attempt |
| Fingerprint | Hash of the canonical meta-model of a schema |
| Release file | The file written per release with the part hashes of new and changed snippets |
| Compatibility floor | The oldest application version that must work on the current schema |
| Adapter | A thin program that sends the migration script to the database |
| Replaceable object | A view, function, procedure or trigger. It is replaced as a whole, not migrated |
| Included | Ledger state of a snippet whose effect was already part of the installed or adopted schema |
| Adopt | Put an existing database without a ledger under MIG-Ace, at a named release |
| Project setting, machine setting | What is proven, and how the tool works on one computer |
| Release | A version of the application that was delivered. `mig release` records its snippets in a release file |
| Release line | A series of releases that is maintained separately, for example an older version that still gets hotfixes |
| DDL | Data definition language: statements that change the structure, such as `create table` and `alter table` |
| DML | Data manipulation language: statements that change rows, such as `insert`, `update` and `delete` |
| Data part | A part whose operation is DML. A data migration consists of data parts |
| Phase | `start` or `finish`. Start parts are safe while older application versions run; finish parts are not |
| Late snippet | A snippet that reaches a database after snippets that sort behind it already ran there |
| Slug | The name of a snippet without its timestamp. Used for references between snippets |
