# Agent Memory & Performance

## Lessons Learned
- **2026-03-06**: Initialized ADL environment.
- **2026-03-06**: Pivoted project goal to a **Firebase-native refactor**. Identified JSON schemas as the replacement for the dynamic PostgreSQL metadata engine. Decided to keep the existing backend in **Google Cloud Run** for a hybrid migration approach.
- **2026-03-07**: Implemented automated JSON schema extraction from core DTOs using `class-validator-jsonschema`. Discovered that fields decorated only with `@HideField()` (GraphQL) require explicit `class-validator` decorators (e.g., `@IsString()`) to be correctly captured in the generated schemas. This ensures that the Firestore-native metadata engine will have complete and valid schemas for all entities, even those not exposed via GraphQL. Established a test suite to verify schema integrity after generation.
- **2026-03-07**: Developed a **BaseFirestoreRepository** to emulate TypeORM's repository interface, facilitating a seamless transition from PostgreSQL. Key strategies included:
    - **Dynamic Schema Loading**: Automating the registration of `ajv` schemas from a central JSON-schema directory to decouple validation from entity classes.
    - **Validation Strategy**: Implementing a "partial validation" approach by dynamically stripping `required` constraints from base schemas to support partial updates without maintaining separate update-specific schemas.
    - **Query Translation**: Manually mapping TypeORM `FindOptions` (e.g., `where`, `moreThan`, `in`) to Firestore's native querying capabilities, acknowledging the inherent limitations of NoSQL compared to relational filtering.
    - **Atomic Batching**: Leveraging Firestore's `WriteBatch` for bulk operations (`save`, `insert`, `upsert`) to ensure data consistency and minimize API round-trips.
    - **Emulated Upsert**: Using Firestore's `set(doc, data, { merge: true })` as a reliable implementation for both `save` and `upsert`, provided a unique identifier (ID) is present.