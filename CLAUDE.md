# MIG-Ace

A schema migration framework for PostgreSQL and Hibernate. It writes migrations from the difference between the schema the application expects and an older database, and proves them on a database with data.

**Status: design phase. There is no code yet.** The website in `website/` describes MIG-Ace as if it were finished.

## Where things are

- `MIG-Ace-vault/home.md`: start page of the specs and internal documentation (an Obsidian vault).
- `MIG-Ace-vault/how-to-use-this-vault.md`: status markers and writing rules. Read it before changing the vault.
- `MIG-Ace-vault/architecture/repository-layout.md`: what each top-level folder is for.
- `MIG-Ace-vault/roadmap.md` and `MIG-Ace-vault/specs/`: what to build next.

Read only the notes a task needs. Do not load the whole vault.

## Rules

- **Branches.** `main` is the current release. Work on `candidate`, or on a feature branch if one exists for the task. Push directly. No pull requests.
- **The vault is the reference.** `[decided]` changes only with a new decision by the project owner. `[direction]` is the working assumption. `[open]` means: ask, do not guess.
- **Do not propose a rejected alternative again** without a new argument. They are listed in `MIG-Ace-vault/decisions/`.
- **Write down what you find.** New questions go to `MIG-Ace-vault/questions/open-questions.md`, findings to `MIG-Ace-vault/journal/`. Nothing that matters stays only in a chat.
- **Examples use the bookshop only.** Never add names, code, data or examples from any real or private project.
- **Dependencies.** `core/` imports nothing from `databases/` or `language/generators/`.
- **Tests.** Written from the acceptance criteria before the code. No test may need Docker. See `MIG-Ace-vault/testing/test-concept.md`.
- **Invented names.** Command names, option names and setting names on the website are provisional unless the vault marks them `[decided]`.

## Commands

Website:

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # static site in website/dist
```

The tool has no build yet. The first milestone defines it.
