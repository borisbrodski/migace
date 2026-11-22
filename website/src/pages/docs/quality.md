---
layout: ../../layouts/Doc.astro
title: How MIG-Ace is tested
description: Test counts, code coverage and mutation testing of MIG-Ace, with the limits that every build enforces.
lead: A tool that changes production databases has to be tested harder than the applications that use it. This page says how MIG-Ace is tested, how much of its code the tests reach, and how we check that the tests would notice a mistake.
---

> MIG-Ace is in early development. The numbers on this page are from 22 November 2026 and cover the parts that exist: the language, the PostgreSQL generation, the migration script with its ledger, and the Java runner.

## The numbers

| | Measured | Enforced in every build |
|---|---|---|
| **Tests, TypeScript** | 1,341 | all pass |
| **Tests, Java runner** | 48 | all pass |
| **Tests on a real PostgreSQL server** | 22, on versions 15 and 18 | all pass |
| **Line coverage, TypeScript** | 99.4 % | at least 99 % |
| **Branch coverage, TypeScript** | 95.4 % | at least 95 % |
| **Function coverage, TypeScript** | 99.6 % | at least 99 % |
| **Line coverage, Java runner** | 94 % | at least 94 % |
| **Branch coverage, Java runner** | 93 % | at least 93 % |
| **Mutation score, Java runner** | 96 % (101 of 105) | reported |
| **Mutation score, schema model and comparison** | 94 % (320 of 338) | reported |

A build fails when the coverage falls below a limit. The limits are the levels that are reached today. They are raised when the coverage rises.

## Coverage is not enough

Coverage says which lines the tests run. It does not say whether a test would fail if a line were wrong. So we also break the code on purpose.

**Mutation testing** changes the code in one small way at a time: a `<` becomes `<=`, a condition becomes `false`, a call is removed. Then the tests run. If they still pass, nobody would have noticed that mistake. The mutation score is the share of changes that a test noticed.

- The first run on the Java runner found 16 changes that no test noticed, a score of 85 %. Tests were added for them. Today four remain: three in the three lines that start the program, and one change that does not alter the behaviour.
- The four that remain in the Java runner are listed in the repository, with the reason for each.

**Breaking the migration script.** Most logic of a migration is SQL inside the generated script, where a mutation tool sees only text. So we break it by hand, one rule at a time, and run the tests. Eleven rules were broken, for example:

| What was broken | Noticed by |
|---|---|
| The lock that allows one run at a time is never taken | a test of two runs |
| A waiting run keeps its transaction open | a test on a real server: the two runs block each other |
| A step that was interrupted is not marked as abandoned | a test of a killed run |
| A failed snippet is stored as done | a test of the ledger |
| The time limit for locks is not set | a test on a real server with a locked table |
| A part counts as run when only its first step is done | **nothing**, at first |

The last one was a real gap. A test for it was added, and the series was repeated: all eleven are noticed now.

## What the tests are

| Kind | What it checks |
|---|---|
| **Language tests** | Every statement of the language: what is accepted, what is refused and with which message, what a name refers to, what the editor offers. |
| **Generation tests** | The SQL for every statement is stored in the repository and compared. The stored SQL is also run on a database, and its effect is compared with what is expected. |
| **Random input** | Thousands of damaged snippets. The parser and the checks must never crash. |
| **Script tests** | The migration script on a database: first run, second run, failures, retries, conditions, checks, the ledger. |
| **Hard cases on a real server** | Two runs at once. A connection that is closed after any single statement of the script. A session that the server ends. Locks held by another session. An interrupted `create index concurrently`. |
| **Contract cases** | 23 cases as data files say what a runner must do. The reference runner and the Java runner both pass every case. A runner in another language can use the same files. |

No test needs Docker. The tests on a real server start a PostgreSQL from a package of binaries and remove it afterwards.

Every push is built and tested on **Linux, Windows and macOS**: all tests, the coverage limits, and the tests on a real PostgreSQL 18. PostgreSQL 15, the oldest supported version, runs every night on Linux.

## Run it yourself

```sh
npm test               # all tests; the Java tests too, if a JDK is installed
npm run test:coverage  # coverage of the TypeScript code, with the limits
npm run test:server    # the tests on a real PostgreSQL
npm run test:mutation  # mutation testing of the TypeScript code; takes long
```

For the Java runner, in `clients/java`:

```sh
./gradlew check        # tests and coverage limits
./gradlew pitest       # mutation testing
```

## What is not covered yet

- Mutation testing of the language and the generators has not completed a full run. It is not part of every build.
- The parts of MIG-Ace that are not built yet have no tests.
