# MIG-Ace

Provable schema migrations for PostgreSQL & Hibernate.

> Early development. Nothing is released yet.

MIG-Ace migrates a database that already contains data and then proves the result is identical to the schema your application expects (generated from the Hibernate model). Every snippet is logged part by part and can be re-run safely.

- **Website:** https://migace.openbrod.org
- **Design:** the Obsidian vault [`MIG-Ace-vault/`](MIG-Ace-vault/home.md) holds the specs and internal documentation: what is decided, what is the working direction and what is still open.
- **Layout:** [repository layout](MIG-Ace-vault/architecture/repository-layout.md).

## Branches

`main` is the current release. Work happens on `candidate`. Changes are pushed directly, without pull requests.

## Setting up a clone

```sh
git checkout candidate
git config core.hooksPath tools/git-hooks
```

The hook blocks a commit that contains a word from the file `.private-words` in the root of the clone. Create that file yourself, with one word or phrase per line. It is not in git.

## Development

The tool is a workspace of npm packages. It needs Node 22.22.2 or newer (see `engines` in `package.json`) and no Docker.

```sh
npm install            # installs every package; fails on an unsupported Node version
npm run build          # generates the Langium parser and compiles every package
npm run lint           # ESLint, including the rule that keeps core/ free of database code
npm test               # all tests of all packages, and the Java tests if a JDK is there; needs no database server
npm run test:server    # the tests on a real PostgreSQL, started from a package of binaries; no Docker
npm run test:generate  # rewrites the expected SQL in migql/constructs/*/generated; review the diff
```

### Tests, coverage and proof

| | Measured on 2026-11-22 | Enforced |
|---|---|---|
| Tests, TypeScript | 1,341 | all pass |
| Tests, Java runner | 48 | all pass |
| Tests on a real PostgreSQL (15 and 18) | 22 | all pass |
| TypeScript: lines / branches / functions | 99.4 % / 95.4 % / 99.6 % | 99 % / 95 % / 99 % |
| Java runner: lines / branches | 94 % / 93 % | 94 % / 93 % |
| Mutation score, Java runner | 96 % | reported |
| Mutation score, `core/` | 94 % | reported |

```sh
npm run test:coverage  # coverage of the TypeScript sources; fails below the limits in vitest.coverage.config.ts
npm run test:mutation  # Stryker: changes the sources and checks that a test notices; takes long
cd clients/java
./gradlew check        # tests and the JaCoCo limits in build.gradle
./gradlew pitest       # PIT: the same idea for the Java runner
```

Every push is built and tested on Linux, Windows and macOS (`.github/workflows/build.yml`), including the tests on a real PostgreSQL.

The limits are the levels that are reached now. Raise them when the coverage rises. Reports are written to `coverage/`, `reports/mutation/`, `clients/java/build/reports/`. The website has the same numbers on the page [How MIG-Ace is tested](website/src/pages/docs/quality.md).

Other expected files are updated with Vitest, in the folder of the package: `npx vitest run -u`. Review the diff as well.

Inside `migql/`, `npx vitest` runs the tests in watch mode. Run `npm run langium:generate` there after a change to the grammar.

## Website

The website is an [Astro](https://astro.build) project in [`website/`](website/). The workflow [`.github/workflows/website.yml`](.github/workflows/website.yml) builds it and publishes it to GitHub Pages on every push to `main` that touches `website/`.

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # output in website/dist
```

## Licence

MIG-Ace is open source under the [Apache License 2.0](LICENSE). Files that MIG-Ace generates, such as migration scripts, can be used without the conditions of that licence; see [LICENSE-GENERATED-OUTPUT.md](LICENSE-GENERATED-OUTPUT.md).
