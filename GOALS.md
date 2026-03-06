# Project Goals: Firebase-Native Refactor

The ultimate goal is to refactor the Twenty CRM into a serverless, Firebase-native application, replacing the heavy NestJS/Postgres infrastructure with a streamlined, scalable architecture.

## 1. Core Architectural Pivot
- **Backbone**: Adopt the full Firebase ecosystem as the primary infrastructure.
- **Compute**: Migrate backend logic from the monolithic `twenty-server` to **Firebase Cloud Functions**.
- **Hosting**: Deploy the frontend SPA to **Firebase Hosting**.

## 2. Data & Metadata (The "Schema" Shift)
- **Database**: Replace PostgreSQL with **Cloud Firestore**.
- **Metadata Refactor**: Replace the dynamic PostgreSQL-based metadata engine with a **JSON Schema-driven approach**.
- **Server-Generated Schemas**: Utilize JSON schemas to define object structures (Person, Company, etc.), allowing for validation and structure without the overhead of dynamic SQL table generation.

## 3. Authentication & Identity
- **Provider**: Migrate from Passport.js/JWT to **Firebase Authentication**.
- **Security**: Implement Firestore Security Rules based on Firebase Auth claims to handle multi-tenancy and access control.

## 4. Ecosystem Integration
- **Storage**: Use **Firebase Cloud Storage** for attachments and assets.
- **Messaging**: Use **Firebase Cloud Messaging (FCM)** for real-time notifications.
- **Extensions**: Leverage Firebase Extensions (e.g., Search with Algolia, Trigger Email) to replace custom server modules.

## 5. Development Standards
- **Idiomatic Firebase**: Prefer the Firebase Web SDK in the frontend to reduce API layer complexity.
- **Maintainability**: Reduce the codebase size significantly by removing the TypeORM/NestJS/Postgres boilerplate.
