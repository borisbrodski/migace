---
type: guide
status: decided
---

# How to use this vault

## Status markers

Every statement in the architecture and language notes carries a marker.

| Marker | Meaning |
|---|---|
| **[decided]** | Agreed by the project owner. Change it only with a new decision. |
| **[direction]** | Proposed and used as the working assumption, but not yet confirmed. |
| **[open]** | Not settled. Listed in [Open questions](questions/open-questions.md). |

## Where things go

| Folder | Content |
|---|---|
| `architecture/` | How MIG-Ace works. One note per topic. |
| `language/` | The language used in snippets: syntax, meaning, generation, stability. |
| `testing/` | The test concept and its plans. |
| `decisions/` | One note per decision: context, decision, rejected alternatives. |
| `specs/` | What to build next, with acceptance criteria. One note per milestone or feature. |
| `questions/` | Open questions. A question is closed by a decision. |
| `journal/` | Dated findings from implementation sessions. |
| `templates/` | Templates for new notes. |

## Rules

- **The vault is the reference.** The website describes MIG-Ace as if it were finished. Where the website shows a detail that the vault marks as open, the vault is right.
- **Do not propose a rejected alternative again** without a new argument. The rejected alternatives are in `decisions/`.
- **Write down what you find.** A new question goes into `questions/open-questions.md`. A finding goes into `journal/` as `YYYY-MM-DD-topic.md`. Nothing that matters stays only in a chat.
- **All examples use the bookshop.** Never add names, code, data or examples from any real or private project to this repository.
- **A new decision** gets a note in `decisions/`, and the architecture note is updated in the same commit.

## Writing conventions

- File names are lower case with dashes: `upgrade-phases.md`.
- Links are plain Markdown links with relative paths, not wikilinks. They then work in Obsidian, on GitHub and for coding agents. The shared Obsidian settings in `.obsidian/app.json` already do this.
- Every note starts with properties: `type`, and `status` (`decided`, `direction`, `open` or `mixed`).
- Plain language. One fact per sentence.
