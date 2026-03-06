import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import * as admin from 'firebase-admin';

describe('Firestore Emulator Connection', () => {
  let db: admin.firestore.Firestore;
  let testDocRef: admin.firestore.DocumentReference;

  beforeAll(async () => {
    // Disable fake timers for this specific test suite as gRPC requires real timers to function
    jest.useRealTimers();

    // Initialize the firebase-admin SDK if it hasn't been initialized yet
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'demo-twenty',
      });
    }

    db = admin.firestore();
    db.settings({
      host: '127.0.0.1:8080',
      ssl: false,
    });
  });

  afterAll(async () => {
    // Clean up the test document
    if (testDocRef) {
      await testDocRef.delete();
    }
    // Delete the default app to prevent issues with other tests that might use firebase-admin
    if (admin.apps.length > 0 && admin.app()) {
      await admin.app().delete();
    }

    // Restore fake timers to not affect other tests
    jest.useFakeTimers();
  });

  it('should create, read, and delete a document in the emulator', async () => {
    const collectionName = 'test_collection';
    const docData = {
      name: 'Integration Test Document',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      testRunId: Date.now(),
    };

    // 1. Create: Add a document to the collection
    testDocRef = await db.collection(collectionName).add(docData);
    expect(testDocRef.id).toBeDefined();

    // 2. Read: Fetch the created document
    const docSnapshot = await testDocRef.get();
    expect(docSnapshot.exists).toBe(true);

    const retrievedData = docSnapshot.data();
    expect(retrievedData).toBeDefined();
    expect(retrievedData?.name).toBe(docData.name);
    expect(retrievedData?.testRunId).toBe(docData.testRunId);
    expect(retrievedData?.createdAt).toBeDefined();

    // 3. Delete: Remove the test document
    await testDocRef.delete();

    // Verify deletion
    const deletedSnapshot = await testDocRef.get();
    expect(deletedSnapshot.exists).toBe(false);
  });
});
