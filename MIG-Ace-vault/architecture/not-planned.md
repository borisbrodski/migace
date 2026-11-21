---
type: architecture
status: mixed
---

# Not planned

- Code parts in snippets (a Java class executed as a migration step). A static script cannot run them, and their content cannot be checksummed reliably. **[direction]**
- Data fixes that need business logic. They are written in Java inside the application and tracked there, outside MIG-Ace. See [the decision](../decisions/complex-data-fixes-in-java.md). **[decided]**
- A registry of running application instances. The application has no way to sign off. **[decided]**
- Automatic re-execution of a changed part. **[decided]**
- Production rollback (down migrations). **[direction]**
- A migration graph with merge migrations. **[decided]**
