---
type: guide
status: decided
---

# Coding rules

## Test-driven development, strictly

This applies to every coding task that is not user-interface work. **[decided]**

Work in small cycles. One cycle:

1. **Add one unit test** for the next feature, or for the next small step towards it.
2. **Run it and see it fail.** A test that passes at once proves nothing new. Change it until it fails for the right reason.
3. **Add the implementation.** Write only what the test requires, just enough to make it pass. No extra logic for cases that no test asks for.
4. **Refactor.** Make the code and the tests clean and well structured. Remove comments that only tell the history of the change. All tests stay green.

Then start the next cycle.

Notes on applying it:

- The acceptance criteria of a spec say what has to exist at the end. The cycles are the way there; one criterion usually needs many cycles.
- Step 2 is not optional. Do not write the test and the implementation in one go.
- If the implementation needs something no test asks for, write that test first.

## Other rules

- **Commit small.** Commit at the end of a cycle or of a few cycles that belong together, at least once per acceptance criterion. The history then shows how the code grew. **[direction]**
- **A non-goal of a spec is not built.** If it seems needed, write the reason into the journal and ask. **[direction]**
- No test may need Docker.
- `core/` imports nothing from `databases/` and nothing from `migql/generators/`.
- All examples use the bookshop. Nothing comes from a real or private project.
- When a spec leaves a detail open, do not invent it silently. Write the question into [Open questions](../questions/open-questions.md), choose the least surprising option, and mark the choice in the journal.
