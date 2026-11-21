---
type: questions
status: open
---

# Open questions

1. **Key name for the neutral statement:** `do` or `sql`.
2. **One operation per part,** or a list of operations per part.
3. **Test-data values:** expressions with SQL quotes (`'HW'`) or plain YAML data.
4. **Spelling of the "any valid row" shortcut** in test data.
5. **Reference to a released part version in a condition:** by release name or by checksum, and its spelling.
6. **File reference form for native SQL** kept in separate files.
7. **Seed and reference data:** ordinary snippets as today, or a repeatable definition applied on every run. A new database gets these rows from `schema/` and an upgraded one from snippets (see [Execution and ledger](../architecture/execution-and-ledger.md)). Proposal: tables listed as `reference-tables` are compared row by row in the proof loop.
8. **Editor association:** whether VS Code and IntelliJ let MigQL win over the built-in `.yaml` association for `*.migql.yaml`.
9. *Closed 2026-11-21:* one Langium grammar carries the envelope and the statements, with a lexer of our own. See [the journal](../journal/2026-11-21-workspace-and-migql-parser.md).
10. **Temporary procedures in the script:** whether a session-temporary procedure may commit when called at top level in PostgreSQL. If not, the logic is inlined per part.
11. **Row-level security and grants:** deployment tier by default; confirm when a project needs them compared.
12. **DDL from entities:** whether MIG-Ace helps to generate the DDL file from the entity classes, or whether that stays the responsibility of the application build. It needs the compiled classes, the persistence unit and exactly the Hibernate version and settings used in production.
13. **Triggers during data migrations:** triggers of the old release stay active while snippets run. Whether a part can switch them off for its statement, and how, is not settled.
14. **Materialized views:** replaceable like views, or changed by snippets.
15. **Install content:** the statements of `schema/` inside the migration script, or a second script for new databases.
16. **Definition of the release order:** derive the branch from the release files, or state it in the snippet. See [Ordering](../architecture/ordering-and-releases.md).
17. **Limit for unfinished upgrades:** should `start` refuse when the last finished release is older than `compatible-with`? Without the limit, every supported release needs its own deferred test chain. See [Upgrade phases](../architecture/upgrade-phases.md).
18. **Condition on order:** `when: ran f before c`, and its spelling.
19. *Closed 2026-11-21:* the language is called MigQL. See [the decision](../decisions/migql-name-and-extension.md).
20. **Projects that release from a candidate branch:** their release files never reach the main branch, so the mapping from release to snippets is missing there. Not needed for the first users.
21. **Stability check for generated SQL:** store a hash of the generated statement per part and database in the release file. See [Language stability](../migql/stability.md).
22. *Closed 2026-11-21:* `upgrade-from` keeps its name for now.
23. **Format of acceptance scenarios.** See [Test concept](../testing/test-concept.md).
24. *Closed 2026-11-21:* the website now shows `rename column` with the `start` and `finish` phases. The two examples parse and are no longer skipped.
25. **`upsert`:** the operation is listed in [Snippets](../architecture/snippets.md) and in M1-AC-08, but no note says how it is written. It is not implemented.
26. **`former-names`, `before`, `after`:** the keys are listed in [Snippets](../architecture/snippets.md) without the form of their values. They are not implemented.
27. **Comment after a one-line statement:** is `do: delete from t # why` allowed? It is accepted now, because YAML reads it the same way. M1-AC-14 can be read as: every ` #` in a one-line statement is an error.
28. **`?` in a statement:** the website writes `do: update customer set loyalty_level = ?` in a part with a `todo`. The parser accepts `?` only in such a part. Confirm, or choose another sign.
29. **Values in flow maps:** YAML and MigQL read `{ a: coalesce(x, 1) }` differently. Proposal in [the journal](../journal/2026-11-21-workspace-and-migql-parser.md): only literals and names in a flow map.
30. **Quoted names:** how is a column written whose name is a keyword of the statement language? Proposal: double quotes, as in SQL.
31. **Lists at the indentation of their key:** YAML allows `parts:` and `- name:` in the same column. MigQL does not. Support it, or keep the rule and improve the message.
32. **Functions in expressions:** which functions may a snippet call? M3 proposes a list in `migql/functions.md`.
33. **Automatic lock-safe forms:** `set not null` and a new foreign key are generated in the safe multi-step form. Should `create index` always be generated as `concurrently`, also when the author did not write it?
34. **Contributor agreement:** do contributors sign an agreement that allows a later change of licence?

Recommendations for questions 25 to 31 are in the [review of M0 and M1](../journal/2026-11-21-review-of-m0-and-m1.md).
