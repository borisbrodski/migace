---
type: language
status: direction
---

# Keywords and names

Every keyword of the statement language, and whether it can be a name without quotes. **[direction]**

The rule is in [Names and case](names-and-case.md): a keyword is accepted as a name without quotes if it never stands where the grammar has to choose between it and a name. Every other keyword needs double quotes to be a name: `"select"`. Words of the YAML part, such as `do` and `rows`, are no keywords inside a statement.

A test compares this table with the grammar (`migql/test/parser/names.test.ts`). A keyword that is added to the grammar has to be added here, with its reason.

26 of 58 keywords can be a name without quotes.

| Keyword | Name without quotes | Reason |
|---|---|---|
| `add` | yes | starts a change of a table |
| `all` | yes | a value of `fill` |
| `alter` | yes | starts a statement or a change of a table |
| `and` | no | continues an expression |
| `as` | no | continues an expression inside `cast` |
| `between` | no | continues an expression |
| `by` | yes | only in `batch` |
| `case` | no | starts an expression |
| `cast` | no | starts an expression |
| `check` | no | starts a constraint where a column may start |
| `column` | yes | follows a verb; as a condition it continues with `table.column exists` |
| `concurrently` | no | may stand before the name of an index |
| `constraint` | no | starts a constraint where a column may start |
| `create` | yes | starts a statement |
| `data` | yes | only inside `set data type` |
| `date` | yes | starts a date literal, which continues with a text in quotes |
| `default` | no | follows the type of a column |
| `delete` | yes | starts a statement |
| `drop` | yes | starts a statement or a change of a table |
| `else` | no | continues `case` |
| `end` | no | ends `case` |
| `ensure` | no | starts a statement that becomes an action in M3.2 |
| `exists` | no | starts and ends a condition |
| `false` | no | is a value |
| `finish` | yes | the value of `phase` |
| `for` | yes | only in `next value for` |
| `foreign` | no | starts a constraint where a column may start |
| `from` | no | starts a clause |
| `in` | no | continues an expression |
| `index` | yes | follows a verb; as a condition it continues with a name and `exists` |
| `insert` | yes | starts a statement |
| `into` | yes | only after `insert` |
| `is` | no | continues an expression |
| `key` | yes | only after `primary` and `foreign` |
| `like` | no | continues an expression |
| `next` | yes | starts `next value for`, which continues with `value` |
| `not` | no | starts and continues an expression |
| `null` | no | is a value |
| `on` | yes | only between the name of an index and its table |
| `or` | no | continues an expression |
| `primary` | no | starts a constraint where a column may start |
| `ran` | no | starts a condition; as a name it would hide the completion of parts in the editor |
| `references` | no | follows the type of a column |
| `rename` | yes | starts a statement |
| `required` | yes | a value of `fill` |
| `select` | no | starts a subquery |
| `set` | no | starts a clause; a name before it would be read as an alias |
| `table` | yes | follows a verb; as a condition it continues with a name and `exists` |
| `then` | no | continues `case` |
| `to` | yes | only in `rename` |
| `true` | no | is a value |
| `type` | yes | only inside `alter column` |
| `unique` | no | starts a constraint where a column may start, and may stand before the name of an index |
| `update` | yes | starts a statement |
| `value` | yes | only after `next` |
| `values` | yes | only after the column list of `insert` |
| `when` | no | continues `case` |
| `where` | no | starts a clause; a name before it would be read as an alias |

## What "no" means for an author

`update orders set where = 1` is an error that proposes the quotes: `"where"`. Most of these words need quotes in SQL as well.

## How to move a word to "yes"

Add it to the rule `Name` in `migql/grammar/migql.langium` and to this table. The tests then use it as the name of a table and of a column, in a statement and in a condition. If one of them fails, the word stays "no".
