---
type: journal
date: 2026-11-27
milestones: []
---

# Switching triggers off for the run only

Measured by the review for question 67, on PostgreSQL 18.7, with a table `book` that has a trigger and a foreign key to `author` with `on delete cascade`. Three sessions: an administrator, the run (as the owner of the schema, no superuser) and another session that stands for the running application.

## (a) `session_replication_role = replica` in the session of the run

| Step | Result |
|---|---|
| The owner sets it | refused: "permission denied to set parameter" |
| After a superuser ran `grant set on parameter session_replication_role to …` | accepted |
| The run inserts a row | the trigger does not fire |
| The other session inserts a row | the trigger fires |
| The run inserts a book whose author does not exist | **accepted**. The foreign key is not checked. |
| The run deletes an author with `on delete cascade` | **the books of that author stay**. Nothing cascades. |
| A trigger marked `enable always` | fires in the run as well |

The foreign keys of PostgreSQL are triggers inside. This setting switches them off together with the triggers of the application. A data part with a mistake can then leave rows that break a foreign key, and the constraint still counts as valid.

## (b) `alter table … disable trigger user` inside the transaction of one part

| Step | Result |
|---|---|
| The owner of the table does it, not a superuser | accepted |
| The run inserts a row in that transaction | the trigger does not fire |
| The run inserts a book whose author does not exist | refused by the foreign key |
| The other session reads the table meanwhile | not blocked |
| The other session inserts a row meanwhile | waits until the transaction of the run ends (800 ms in the test), then the trigger fires for it |
| The trigger after the transaction | enabled, as before |

The run switches the triggers on again before it commits, so no other session ever sees them off. The price: other sessions that write this table wait for as long as the part takes. For a large data part this is a reason to use `batch`, which keeps each transaction short.

For this way the script has to know which tables a data part writes. For a statement of MigQL that is known. For a `native` part the parser of the database tells it, except for code inside a text.

## Assessment

(a) is one line and covers everything, but it changes what the data statements of a run do, and it needs a right from a superuser. (b) keeps the foreign keys, needs no special right, and costs waiting writers. The review recommends (b), per data part, and that it can be switched off for a part whose statement needs the triggers.
