# MIG-Ace

A schema migration framework for PostgreSQL and Hibernate. It writes migrations from the difference between the schema the application expects and an older database, and proves them on a database with data.

**Status: first code.** The workspace, the MigQL parser with its checks, the schema model with its PostgreSQL reader, and the PostgreSQL generation of statements exist (M0 to M3). Everything else is design. The website in `website/` describes MIG-Ace as if it were finished.

## Where things are

- `MIG-Ace-vault/home.md`: start page of the specs and internal documentation (an Obsidian vault).
- `MIG-Ace-vault/how-to-use-this-vault.md`: status markers and writing rules. Read it before changing the vault.
- `MIG-Ace-vault/architecture/repository-layout.md`: what each top-level folder is for.
- `MIG-Ace-vault/roadmap.md` and `MIG-Ace-vault/specs/`: what to build next. `specs/README.md` says how far each milestone is.
- `MIG-Ace-vault/journal/`: what was found while building. Read the newest note before you continue a milestone.

Read only the notes a task needs. Do not load the whole vault.

## Rules

- **Branches.** `main` is the current release. Work on `candidate`, or on a feature branch if one exists for the task. Push directly. No pull requests.
- **The vault is the reference.** `[decided]` changes only with a new decision by the project owner. `[direction]` is the working assumption. `[open]` means: ask, do not guess.
- **Do not propose a rejected alternative again** without a new argument. They are listed in `MIG-Ace-vault/decisions/`.
- **Write down what you find.** New questions go to `MIG-Ace-vault/questions/open-questions.md`, findings to `MIG-Ace-vault/journal/`. Nothing that matters stays only in a chat.
- **Examples use the bookshop only.** Never add names, code, data or examples from any real or private project.
- **Dependencies.** `core/` imports nothing from `databases/` or `migql/generators/`.
- **Tests.** No test may need Docker. See `MIG-Ace-vault/testing/test-concept.md`.
- **MigQL.** The language of snippets is called MigQL. Its code is in `migql/`, its notes in `MIG-Ace-vault/migql/`, its files end in `.migql.yaml`.
- **Langium.** MigQL is built and tested with `langium-tools`. Read `MIG-Ace-vault/migql/langium-tools.md` first.
- **Invented names.** Command names, option names and setting names on the website are provisional unless the vault marks them `[decided]`.

## Strict test-driven development

For every coding task that is not user-interface work, work in small cycles:

1. Add one unit test for the next feature or the next small step.
2. Run it and see it fail.
3. Add the implementation: only what the test requires, nothing more.
4. Refactor: clean code and tests, no comments about the history of the change, everything well structured.

Details: `MIG-Ace-vault/engineering/coding-rules.md`.

## Commands

Tool, from the repository root (Node 22.22.2 or newer, no Docker):

```sh
npm install
npm run build          # Langium generation and tsc for every package
npm run lint
npm test               # all packages, then the tests in tools/
npm run test:generate  # rewrite the expected SQL in migql/constructs/*/generated, then review the diff
```

In `migql/`: `npm run langium:generate` after a grammar change, `npx vitest run test/<folder>` for one group of tests.

Website:

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # static site in website/dist
```
