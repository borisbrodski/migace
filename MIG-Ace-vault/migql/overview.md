---
type: language
status: mixed
---

# MigQL: the language of snippets

A snippet file has two layers. Both are parsed by one grammar.

| Layer | What it is | Note |
|---|---|---|
| Envelope | A restricted form of YAML: keys, lists, literal blocks | [YAML profile](yaml-profile.md) |
| Statements and expressions | A SQL-like language for schema changes, data changes and conditions | [Statement language](statement-language.md) |

- Every snippet file is valid YAML. **[decided]**
- The statement language follows common SQL where a portable form exists, and adds only what is missing. **[decided]**
- One statement is translated into the SQL of each supported database. See [Generation](generation.md). **[decided]**
- Old snippets keep their meaning when MIG-Ace changes. See [Stability](stability.md). **[direction]**

In the repository the language lives in `migql/`: grammar, checks, language server, the catalogue of constructs and the generators per database.

## Name and file extension

- The language is called **MigQL**. **[decided]**
- MigQL names the whole language of a snippet file: the envelope and the statements.
- Snippet files end in `.migql.yaml`. **[decided]**
- In the repository the language lives in `migql/`. Another language, if one is ever added, gets its own folder.

Why this name: it is short, it reads like HQL and JPQL, and "QL" does not promise only DDL or only queries, so later control flow does not make it wrong.

## Possible later extension

Simple control flow inside a part, such as `if … then … end if`. Not designed yet. It must stay translatable to every supported database, and it must not turn parts into programs that cannot be checked. **[open]**
