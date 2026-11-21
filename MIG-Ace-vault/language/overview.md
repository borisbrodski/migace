---
type: language
status: mixed
---

# The language of snippets

A snippet file has two layers. Both are parsed by one grammar.

| Layer | What it is | Note |
|---|---|---|
| Envelope | A restricted form of YAML: keys, lists, literal blocks | [YAML profile](yaml-profile.md) |
| Statements and expressions | A SQL-like language for schema changes, data changes and conditions | [Statement language](statement-language.md) |

- Every snippet file is valid YAML. **[decided]**
- The statement language follows common SQL where a portable form exists, and adds only what is missing. **[decided]**
- One statement is translated into the SQL of each supported database. See [Generation](generation.md). **[decided]**
- Old snippets keep their meaning when MIG-Ace changes. See [Stability](stability.md). **[direction]**

In the repository the language lives in `language/`: grammar, checks, language server, the catalogue of constructs and the generators per database.

## Name

The language needs a name, like HQL for Hibernate. **[open]**

Requirements:

- Easy to say and to search for.
- It should not promise only DDL or only queries. Simple control flow (`if`, blocks) may be added later, in the style of PL/SQL and PL/pgSQL but much smaller.
- No clash with a known language.

| Candidate | Assessment |
|---|---|
| MigQL | Recommended. Short, reads like HQL and JPQL, and "QL" is used for languages that do far more than queries. A web search on 2026-11-21 found no language with this name. |
| MADDQL | Names DDL and queries, which becomes wrong when control flow arrives. Hard to say. |
| MQL | Taken many times over. |
| AceQL | Taken by an existing product. |

The file extension stays `.mig.yaml` whatever the name is.

## Possible later extension

Simple control flow inside a part, such as `if … then … end if`. Not designed yet. It must stay translatable to every supported database, and it must not turn parts into programs that cannot be checked. **[open]**
