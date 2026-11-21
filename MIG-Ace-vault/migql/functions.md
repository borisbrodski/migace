---
type: language
status: direction
---

# Functions in expressions

The functions a statement or a condition may call. **[direction]** The list is a working assumption: it starts with the functions the website uses and the ones a subquery needs. See open question 32.

A call of any other function is an error that names the function and points to this list. A function that only one database has belongs in a `native` part.

Names of functions are not case-sensitive.

| Function | Meaning | PostgreSQL |
|---|---|---|
| `upper(text)` | the text in upper case | `upper(text)` |
| `lower(text)` | the text in lower case | `lower(text)` |
| `trim(text)` | the text without spaces at its start and its end | `trim(text)` |
| `substring(text, start, length)` | a piece of the text; the first character has the position 1 | `substring(text, start, length)` |
| `length(text)` | the number of characters | `length(text)` |
| `coalesce(value, …)` | the first value that is not null | `coalesce(value, …)` |
| `days(number)` | a number of days, to add to a date or to subtract from it | `make_interval(days => number)` |
| `count(*)` | the number of rows of a subquery | `count(*)` |
| `max(value)` | the largest value of a subquery | `max(value)` |
| `min(value)` | the smallest value of a subquery | `min(value)` |
| `sum(value)` | the sum of the values of a subquery | `sum(value)` |

These are written with their own syntax and are not functions of this list:

| Syntax | PostgreSQL |
|---|---|
| `cast(value as type)` | `cast(value as type)` |
| `next value for sequence` | `nextval('sequence')` |
| `case when … then … else … end` | the same |

## In the code

- The names and their descriptions are in `migql/src/functions.ts`. The check uses that list.
- The PostgreSQL form of a function that is spelled differently is in `migql/generators/postgresql/expressions.ts`.
- A new function is added in both places and in this note, with a test for each.
