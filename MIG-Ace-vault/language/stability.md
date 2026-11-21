---
type: language
status: direction
---

# Stability of the language

A snippet that was written years ago must keep its meaning when MIG-Ace is updated. Otherwise a database that runs the snippet next year gets a different result than one that ran it last year.

## The guarantee

- **Syntax:** a snippet that was valid stays valid. **[direction]**
- **Meaning:** a statement that was released keeps generating SQL with the same effect. **[direction]**
- Both hold for every construct, function and typed operation that snippets can use.

## How it is enforced

- **The catalogue only grows.** Expected SQL of a released construct is not edited. A changed expectation is a breaking change and needs a decision. **[direction]**
- **Language level.** If a breaking change is ever unavoidable, the project file names the language level, and older snippets are compiled with the meaning of their level. **[open]**
- **Check in the project.** The release file can store a hash of the generated SQL per part and database. A MIG-Ace update that changes the SQL of a released part then fails the build of that project. **[open]**

## Tests

Every released version of MIG-Ace keeps its catalogue. A newer version must produce the same SQL for it. See the compatibility tests in the [Test concept](../testing/test-concept.md).
