# Task Backlog

## Phase 3: Data Migration
- [x] **Verify User Auth Flow**: Confirm that the excluded `passwordHash` doesn't break the intended Firebase Authentication strategy (e.g., ensuring users can still sign in or identifying the need for a password import/reset strategy).
- [ ] **User Import to Firebase Auth**: Implement a migration strategy (either bulk import via script or just-in-time creation during the signup flow) to ensure legacy users can claim their accounts.
- [ ] **Batch Processing & Transformation Audit**: Final review of all migration scripts to ensure the 500-record batching limit and transformation utilities (`transformLinksToFirestore`, `transformEmailsToFirestore`, `transformPhonesToFirestore`) were applied consistently and handled all edge cases.
- [ ] **Execute and Document Migration Audit**: Run the `database:audit-data-migration` command against the complete migrated dataset across all workspaces and document any discrepancies or confirm 100% integrity.
- [ ] **Firestore Index Optimization**: Audit the performance of the new security rules and create necessary composite indexes to support filtered queries across all collections.
- [ ] **Frontend Permission Handling**: Update the frontend application to gracefully handle Firestore permission errors (e.g., 403 Forbidden) and provide user-friendly feedback when actions are restricted by ownership or role rules.
- [ ] **Deprecate PostgreSQL**: Break down and execute the decommissioning of PostgreSQL.
    - [ ] **Remove TypeORM Entities**: Delete the `*.entity.ts` files and related decorators.
    - [ ] **Cleanup Database Connection**: Remove PostgreSQL connection logic and environment variables.
    - [ ] **Decommission Postgres Service**: Update `docker-compose.yml` and deployment scripts.

## Phase 4: Serverless Transition
- [ ] **Cloud Functions Migration**: Port core business logic from NestJS controllers to Firebase Cloud Functions.
- [ ] **Hosting Migration**: Deploy the `twenty-front` application to Firebase Hosting and configure the custom domain.

## Phase 5: Ecosystem & Integration
- [ ] **Cloud Storage Integration**: Migrate file attachments from local/S3 to Firebase Cloud Storage.
- [ ] **Search & Extensions**: Implement search using Firebase Extensions or Algolia and set up Trigger Email extension.
- [ ] **Zapier Integration Refactor**: Update the Zapier integration to point to the new Firebase-native API and use Firebase Auth for authentication.

## COMPLETED WORK
- [x] **End-to-End Migration Validation**: Developed and implemented the `database:audit-data-migration` command to compare PostgreSQL and Firestore data, validating record counts, IDs, schema compliance, relational references, and transformed array fields (emails, phones, links).
- [x] **Frontend Auth Cleanup**: Refactored `useAuth.ts` and dependent components to remove legacy GraphQL mutations and fully adopt `signInWithEmailAndPassword` and `createUserWithEmailAndPassword`. Handled workspace mapping explicitly post-login rather than relying on workspace-specific backend mutations.
- [x] **Firestore Security Rules**: Refined Firestore security rules to support multi-tenant and ownership-aware permissions, including `isOwner()` and `isWorkspaceAdmin()` checks across core and collaborative collections.
- [x] **Collection Migration: 'Users'**: Developed and ran a script to migrate all 'User' records from PostgreSQL to the Firestore 'users' collection, including JSON schema validation and data transformation for Firebase Auth compatibility.
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