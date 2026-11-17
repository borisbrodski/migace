# MIG-Ace

Provable schema migrations for PostgreSQL & Hibernate.

> Early development. Nothing is released yet.

MIG-Ace migrates a database that already contains data and then proves the result is identical to the schema your application expects (generated from the Hibernate model). Every snippet is logged part by part and can be re-run safely.

- **Website:** https://migace.openbrod.org
- **Design:** [ARCHITECTURE.md](ARCHITECTURE.md) records what is decided, what is the working direction and what is still open.

## Website

The website is an [Astro](https://astro.build) project in [`website/`](website/). The workflow [`.github/workflows/website.yml`](.github/workflows/website.yml) builds it and publishes it to GitHub Pages on every push to `main` that touches `website/`.

```sh
cd website
npm install
npm run dev      # local preview
npm run build    # output in website/dist
```
