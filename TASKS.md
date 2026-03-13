I will update the `TASKS.md` file by moving the 'Tasks' and 'Opportunities' migrations to the "COMPLETED WORK" section, breaking down the 'Users' migration into more manageable tasks, and adding an "End-to-End Migration Validation" task to ensure data integrity across all migrated collections.
# Task Backlog

## Phase 3: Data Migration
- [ ] **Collection Migration: 'Users'**: Migrate current 'Users' from PostgreSQL to the Firestore 'users' collection and ensure data parity for Authentication.
- [ ] **End-to-End Migration Validation**: Perform a full audit of all migrated collections (People, Companies, Notes, Tasks, Opportunities, Users) to ensure data integrity, relationship correctness, and consistency with Firestore schemas.
- [ ] **Batch Processing & Transformation Audit**: Apply the 500-record batching limit and transformation utilities (`transformLinksToFirestore`, `transformEmailsToFirestore`, `transformPhonesToFirestore`) to all remaining migration scripts to ensure consistency and Firestore compliance.
- [ ] **Firestore Security Rules**: Define initial security rules based on user ownership and role claims to protect the migrated data.
- [ ] **Deprecate PostgreSQL**: Drop remaining PostgreSQL connections, TypeORM logic, and related services to enforce full reliance on Firestore.

## Phase 4: Serverless Transition
- [ ] **Cloud Functions Migration**: Port core business logic from NestJS controllers to Firebase Cloud Functions.
- [ ] **Hosting Migration**: Deploy the `twenty-front` application to Firebase Hosting and configure the custom domain.

## Phase 5: Ecosystem & Integration
- [ ] **Cloud Storage Integration**: Migrate file attachments from local/S3 to Firebase Cloud Storage.
- [ ] **Search & Extensions**: Implement search using Firebase Extensions or Algolia and set up Trigger Email extension.
- [ ] **Zapier Integration Refactor**: Update the Zapier integration to point to the new Firebase-native API and use Firebase Auth for authentication.

## COMPLETED WORK
- [x] **Collection Migration: 'Opportunities'**: Develop and run a script to migrate all 'Opportunity' records from PostgreSQL to the Firestore 'opportunities' collection.
- [x] **Collection Migration: 'Tasks'**: Develop and run a script to migrate all 'Task' records from PostgreSQL to the Firestore 'tasks' collection.
- [x] **Collection Migration: 'Notes'**: Develop and run a script to migrate all 'Note' records from PostgreSQL to the Firestore 'notes' collection.
- [x] **Collection Migration: 'Companies'**: Develop and run a script to migrate all 'Companies' records from PostgreSQL to the Firestore 'companies' collection.
- [x] **Resolve Metadata Discrepancies**: Use the `database:validate-metadata` tool to identify and fix any schema inconsistencies between Postgres and Firestore before executing data migrations.
- [x] **Manual Metadata Validation**: Conduct a final manual review of sensitive metadata fields (e.g., custom field types, relationship mappings) before starting the full data migration.
- [x] **Complete Firebase Auth Transition**: Update remaining dependencies across the application (e.g. `twenty-front`, `twenty-server`, extensions) to exclusively rely on Firebase Authentication.
- [x] **Legacy Auth Decommissioning**: Remove `JwtAuthStrategy`, related entities, and Passport JWT configuration once the frontend migration is verified.
- [x] **Collection Migration: 'People'**: Develop and run a script to migrate all 'People' records from PostgreSQL to the Firestore 'people' collection.
- [x] **Verify Firestore Metadata Structure**: Perform automated and manual validation to ensure the seeded Firestore metadata is complete and accurately reflects the original Postgres definitions.
- [x] **Metadata Extraction and Seeding**: Extract existing object definitions from Postgres and seed the `_metadata` collection in Firestore according to the new strategy.
- [x] **Metadata Migration Strategy**: Design a Firestore-compatible structure for storing and retrieving object metadata (People, Companies, etc.) that replaces the Postgres-based metadata engine.
- [x] **Token Management**: Update the frontend API client to attach Firebase ID tokens to all outgoing requests and handle session persistence.
- [x] **Frontend Firebase Integration**: Initialize the Firebase Web SDK in `twenty-front` and refactor the login/signup flow.
- [x] **Firebase Admin SDK Setup**: Configure the `twenty-server` with the Firebase Admin SDK and service account for token verification.
- [x] **Auth Middleware & Guards**: Implement a NestJS guard/middleware to verify Firebase ID tokens in the backend, replacing the Passport JWT strategy.
- [x] **Cloud Run Readiness**: Ensure `twenty-server` is fully containerizable (Dockerfile check) and compatible with Firebase execution environments.
- [x] **Firestore Storage Adapter**: Design and implement a base "Firestore-backed" repository in `twenty-server` that implements the same interface as the current TypeORM repositories, using extracted JSON schemas for validation.
- [x] **Firebase Initialization**: Initialize Firebase CLI in the root.
- [x] **Emulator Configuration**: Set up `firebase.json` with Firestore and Auth emulators.
- [x] **Integration Test Scaffold**: Create a simple test in `twenty-server` that connects to the Firestore emulator instead of Postgres.
- [x] **JSON Schema Extraction**: Audit `class-validator` usage in `twenty-server` core entities to generate initial JSON schemas.