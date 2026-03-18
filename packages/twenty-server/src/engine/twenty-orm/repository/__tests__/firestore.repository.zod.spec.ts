import * as admin from 'firebase-admin';
import { z } from 'zod';
import { BaseFirestoreRepository } from '../firestore.repository';

describe('BaseFirestoreRepository Zod Simple', () => {
  let db: admin.firestore.Firestore;
  let repository: BaseFirestoreRepository<any>;

  beforeAll(async () => {
    jest.useRealTimers();
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: 'test-project' });
    }
    db = admin.firestore();
    db.settings({ host: 'localhost:8080', ssl: false });

    repository = new BaseFirestoreRepository(
      'test_simple',
      { getValidator: () => Promise.resolve({ validator: () => true, partialValidator: () => true }) } as any,
      'test_workspace',
      undefined,
      db,
      z.object({ name: z.string() })
    );
  }, 30000);

  it('should validate correctly in repository', async () => {
    // This should fail before any Firestore call
    await expect(repository.create({ name: 123 } as any)).rejects.toThrow();
  });

  it('should work with valid data', async () => {
    const docRef = await repository.create({ name: 'test' });
    expect(docRef.id).toBeDefined();
    const doc = await repository.findOne(docRef.id);
    expect(doc.name).toBe('test');
  }, 30000);
});
