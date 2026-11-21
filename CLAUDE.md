# MIG-Ace

A schema migration framework for PostgreSQL and Hibernate. It writes migrations from the difference between the schema the application expects and an older database, and proves them on a database with data.

**Status: design phase. There is no code yet.** The website in `website/` describes MIG-Ace as if it were finished.

## Where things are

- `MIG-Ace-vault/home.md`: start page of the specs and internal documentation (an Obsidian vault).
- `MIG-Ace-vault/how-to-use-this-vault.md`: status markers and writing rules. Read it before changing the vault.
- `MIG-Ace-vault/architecture/repository-layout.md`: what each top-level folder is for.
- `MIG-Ace-vault/roadmap.md` and `MIG-Ace-vault/specs/`: what to build next. Start with `specs/m0-workspace.md`, then `specs/m1-migql-parser.md`.

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

Website:

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # static site in website/dist
```

The tool has no build yet. The first milestone defines it.
