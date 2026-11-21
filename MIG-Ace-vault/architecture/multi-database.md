---
type: architecture
status: mixed
---

# Multi-database support

- Typed statements render for every dialect. Native SQL is the only dialect-specific source. **[decided]**
- Per dialect, the framework needs: catalog introspection and the fingerprint SQL, a statement renderer, a script target, and a scratch database for the proof loop. **[direction]**
- The editor meta-model is always the PostgreSQL view, because it runs on PGlite. **[direction]**
