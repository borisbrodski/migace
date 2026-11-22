---
type: language
status: direction
---

# Types

The types that MigQL knows. **[direction]** The list is a working assumption: it starts with the types that the catalogue, the bookshop and the website use.

- The name of a type of this list is not case-sensitive: `VARCHAR(20)`, `Varchar(20)` and `varchar(20)` are the same type.
- A type name that is not on this list is the exact name of a type of the schema, such as an enumeration. It follows the rule of [names](names-and-case.md): `Mood` and `mood` are two types.
- A type name in double quotes is always a type of the schema.

| Type | Meaning | PostgreSQL |
|---|---|---|
| `bigint` | a whole number of 64 bits | `bigint` |
| `integer` | a whole number of 32 bits | `integer` |
| `numeric` | a number with a fixed precision and scale: `numeric(12, 2)` | `numeric` |
| `varchar` | a text up to a length: `varchar(200)` | `varchar` |
| `char` | a text of a fixed length: `char(3)` | `char` |
| `text` | a text of any length | `text` |
| `boolean` | true or false | `boolean` |
| `date` | a day | `date` |
| `timestamp` | a day and a time, without a time zone | `timestamp` |

## Gaps

- A type written with several words is not accepted by the grammar: `double precision`, `timestamp with time zone`, `character varying`. See open question 44.
- Details in brackets are numbers only: `varchar(200)`, `numeric(12, 2)`.

## In the code

The list is in `migql/src/types.ts`. A test compares it with this table.
