# Repository Constitution

## Standards
- **Cloud Native**: Prioritize the Firebase ecosystem (Auth, Firestore, Hosting, Functions).
- **Schema-First**: All data models must be defined by a versioned **JSON Schema**.
- **Security-First**: Enforce authorization through **Firestore Security Rules** based on Firebase Auth claims.
- **Idiomatic Frontend**: Use the Firebase Web SDK in `twenty-front` to reduce reliance on the backend API layer.
- **Surgical Backend**: Keep `twenty-server` lean, migrating logic to Firebase Cloud Functions where appropriate.
- **Code Quality**: Maintain strictly idiomatic TypeScript; all new features require tests.
