---
layout: ../../layouts/Doc.astro
title: Editor support
description: Completion, checks and quick fixes for snippets in VS Code and IntelliJ IDEA.
lead: Snippets are text files, and your editor understands them. You get completion and error messages while you type, before any build runs.
---

## What the editor does for you

MIG-Ace comes with a language server, the same kind of helper that gives your IDE its Java support. It works in VS Code, in IntelliJ IDEA and in other editors that speak the Language Server Protocol.

**Completion for the file format.** Type `ver` under a part and the editor offers `verify-before` and `verify-after`, each with a short explanation.

**Completion for tables and columns.** Inside a statement the editor offers the tables and columns of your schema.

```yaml
  - fill-ship-by:
      do: update orders set sh    # offers: ship_by, status, status_id
```

**Errors while you type.**

```text
20260525-1100-orders-ship-by.mig.yaml:14
  Unknown column "shipby" in table orders. Did you mean "ship_by"?
```

**Quick fixes.** Add a missing `testdata` entry, move a statement to a native part, or name an unnamed constraint with one keystroke.

**Navigation.** Jump from `ran 20260518-1000-order-status.link-status` to that part.

## The schema at that point in time

A snippet from last year must not suggest a column that was added last week. So the editor does not use today's schema. For the snippet you are editing, it works out what the schema looks like **at that point**, after all earlier snippets ran.

It also follows the parts above your cursor. A column added in the first part of a snippet is offered in the second.

## Real errors from PostgreSQL

The editor keeps a small PostgreSQL in the background. It runs the statement you are editing there and undoes it right away. That is why you see PostgreSQL's own error messages while you type, not only syntax checks.

## Installation

| Editor | How |
|---|---|
| VS Code | Install the MIG-Ace extension. |
| IntelliJ IDEA | Install the MIG-Ace plugin. |
| Neovim and others | Use `mig ls` as the language server for `*.mig.yaml` files. |

## Without the extension

Snippet files end in `.mig.yaml` and are valid YAML. Any editor shows them with YAML colours.

For basic help without the MIG-Ace extension, point your editor's YAML support at the MIG-Ace schema. It then completes the keys of the file format and shows their documentation. Statements inside `do` are plain text in this mode.

```yaml
# yaml-language-server: $schema=./.migace/schema.json
migration: 20260309-1400-review-table
```

## In code review

A snippet is a small YAML file with familiar SQL inside, so it reads well in a pull request on GitHub or GitLab without any tool. The [release file](/docs/releases-and-branches/) and the schema snapshot show the reviewer what a change means for released snippets and for the schema.
