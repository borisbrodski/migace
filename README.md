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

## Website

The website is an [Astro](https://astro.build) project in [`website/`](website/). The workflow [`.github/workflows/website.yml`](.github/workflows/website.yml) builds it and publishes it to GitHub Pages on every push to `main` that touches `website/`.

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # output in website/dist
```
