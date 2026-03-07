# Task Backlog

## Phase 0: Infrastructure & Emulators (Immediate)
- [x] **Firebase Initialization**: Initialize Firebase CLI in the root.
- [x] **Emulator Configuration**: Set up `firebase.json` with Firestore and Auth emulators.
- [x] **Integration Test Scaffold**: Create a simple test in `twenty-server` that connects to the Firestore emulator instead of Postgres.

## Phase 1: JSON Schema & Adapter Strategy
- [x] **JSON Schema Extraction**: Audit `class-validator` usage in `twenty-server` core entities to generate initial JSON schemas.
- [ ] **Firestore Storage Adapter**: Design a "Firestore-backed" repository in `twenty-server` that implements the same interface as the current TypeORM repositories.
- [ ] **Cloud Run Readiness**: Ensure `twenty-server` is fully containerizable (Dockerfile check).

## Phase 2: Auth Migration
- [ ] **Firebase Auth Integration**: Replace Passport JWT strategy with a Firebase ID Token verifier.
- [ ] **Frontend Auth**: Update `twenty-front` to use the Firebase Web SDK for login.

## Phase 3: Data Migration
- [ ] **Metadata Migration**: Move the "Object Metadata" definitions from Postgres to a `_metadata` collection in Firestore.
- [ ] **Collection Migration**: Port "People" and "Companies" data using the JSON schemas for validation.
