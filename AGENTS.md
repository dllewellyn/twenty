# Agent Memory & Performance

## Lessons Learned
- **2026-03-06**: Initialized ADL environment.
- **2026-03-06**: Pivoted project goal to a **Firebase-native refactor**. Identified JSON schemas as the replacement for the dynamic PostgreSQL metadata engine. Decided to keep the existing backend in **Google Cloud Run** for a hybrid migration approach.
- **2026-03-07**: Implemented automated JSON schema extraction from core DTOs using `class-validator-jsonschema`. Discovered that fields decorated only with `@HideField()` (GraphQL) require explicit `class-validator` decorators (e.g., `@IsString()`) to be correctly captured in the generated schemas. This ensures that the Firestore-native metadata engine will have complete and valid schemas for all entities, even those not exposed via GraphQL. Established a test suite to verify schema integrity after generation.