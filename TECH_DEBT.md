# Technical Debt

## Architectural Debt
- [ ] **TypeORM Legacy**: 5,000+ files are tightly coupled to PostgreSQL and TypeORM.
- [ ] **Monolith Decomposition**: `twenty-server` is a large NestJS monolith that needs to be refactored for Cloud Run and Cloud Functions.
- [ ] **Metadata Engine**: The dynamic SQL-based metadata engine is complex and requires a full rewrite to a JSON schema-driven NoSQL approach.

## Tooling Debt
- [ ] **Emulator Integration**: Need to integrate Firebase Emulators into the CI/CD pipeline and local test suites.
