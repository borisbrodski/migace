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
25. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
26. *Deferred 2026-11-21:* `former-names`, `before` and `after` are left out until the work on ordering starts. Their form is decided then.
27. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
28. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
29. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
30. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
31. *Closed 2026-11-21:* see [MigQL syntax decisions after the first implementation](../decisions/migql-syntax-after-m1.md).
32. **Functions in expressions:** which functions may a snippet call? The working list is in [Functions](../migql/functions.md): eleven functions, taken from the website and from what a subquery needs.
33. *Closed 2026-11-21:* see [MigQL answers after the PostgreSQL generation](../decisions/migql-answers-after-m3.md).
34. **Contributor agreement:** do contributors sign an agreement that allows a later change of licence?
35. *Closed 2026-11-21:* see [MigQL answers after the PostgreSQL generation](../decisions/migql-answers-after-m3.md).
36. *Closed 2026-11-21:* see [MigQL answers after the PostgreSQL generation](../decisions/migql-answers-after-m3.md).
37. *Closed 2026-11-21:* see [MigQL answers after the PostgreSQL generation](../decisions/migql-answers-after-m3.md).
38. *Closed 2026-11-21:* a name is exact, with or without quotes. See [the decision](../decisions/names-are-exact.md).
39. **Names without quotes on a database with another default form:** the direction is a project setting with which MIG-Ace reads names as SQL does, see [Names and case](../migql/names-and-case.md). Open: the name of the setting, and when it is built.
40. **A double quote inside a name:** not supported. Is it ever needed?
41. *Closed 2026-11-22:* every PostgreSQL version that the PostgreSQL project still supports. The lowest version may be raised when a feature needs it.
42. *Closed 2026-11-22:* Java 11. It may be raised when a feature needs it.
43. **Several statements in one part:** every statement except native SQL is now parsed, so a part could hold a list of statements. The review advises against it for now: a condition, a check, a retry and a ledger row would then belong to a group, and only PostgreSQL could undo a half-done group. Steps are not this idea: a step is generated, see the [glossary](../glossary.md).
44. **Names of the actions:** the scheme of the names, the name of every action of the first catalogue, and the form of their values. See [Actions](../migql/actions.md). Nothing is built before this is answered.
