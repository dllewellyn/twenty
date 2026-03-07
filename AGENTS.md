I will update the `AGENTS.md` file with the lessons learned from the implementation of the Firebase Authentication Guard and Strategy, focusing on hybrid authentication, passport customization, and maintaining type safety.

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
- **2026-03-07**: Optimized the deployment architecture for Google Cloud Run and Firebase Hosting. Key findings included:
    - **Cloud Run Native Optimization**: Specialized Dockerfiles (`Dockerfile.cloudrun`) using multi-stage builds and `yarn workspaces focus --production` significantly reduce production image sizes. Applications must also be configured to listen on the dynamic `$PORT` provided by Cloud Run.
    - **Unified Ingress Strategy**: Utilizing Firebase Hosting `rewrites` to route specific paths (e.g., `/api/**`) to Cloud Run creates a seamless, unified entry point for both static and dynamic backend services.
    - **Artifact Registry Standardization**: Transitioning to Google Artifact Registry (`pkg.dev`) provides a more robust and secure alternative for container image hosting within the GCP ecosystem.
- **2026-03-07**: Successfully implemented a **Firebase-native Authentication** layer, replacing the legacy JWT-based system. Key insights included:
    - **Passport Customization**: Leveraging `passport-custom` allowed for seamless integration of Firebase Admin SDK's token verification within the existing NestJS/Passport ecosystem, providing a flexible way to handle non-standard Google-signed tokens.
    - **Type Safety via Declarations**: When integrating libraries with missing or poor type definitions (e.g., `passport-custom`), providing a local `.d.ts` declaration is critical for maintaining idiomatic TypeScript and avoiding unsafe `any` types.
    - **Systemic Migration Strategy**: A bulk replacement of `JwtAuthGuard` with `FirebaseAuthGuard` across the controller layer ensured architectural consistency and finalized the security transition in a single, verified pass.
    - **Test Suite Precision**: Established a clear distinction between unit and integration tests by correctly naming mocked dependency tests as `*.spec.ts`, improving the reliability and maintainability of the authentication test suite.