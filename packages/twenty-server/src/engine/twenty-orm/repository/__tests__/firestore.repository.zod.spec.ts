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

  it('should apply Zod transformations and defaults', async () => {
    const transformSchema = z.object({
      name: z.string().transform((val) => val.toUpperCase()),
      role: z.string().default('user'),
    });

    const transformRepository = new BaseFirestoreRepository(
      'test_transform',
      {
        getValidator: () =>
          Promise.resolve({ validator: () => true, partialValidator: () => true }),
      } as any,
      'test_workspace',
      undefined,
      db,
      transformSchema,
    );

    const docRef = await transformRepository.create({ name: 'john' });
    const doc = await transformRepository.findOne(docRef.id);

    expect(doc.name).toBe('JOHN');
    expect(doc.role).toBe('user');
  }, 30000);

  it('should work with valid data', async () => {
    const docRef = await repository.create({ name: 'test' });
    expect(docRef.id).toBeDefined();
    const doc = await repository.findOne(docRef.id);
    expect(doc.name).toBe('test');
  }, 30000);

  it('should support update with Zod validation', async () => {
    const docRef = await repository.create({ name: 'initial' });
    await repository.update(docRef.id, { name: 'updated' });
    const doc = await repository.findOne(docRef.id);
    expect(doc.name).toBe('updated');

    await expect(
      repository.update(docRef.id, { name: 123 } as any),
    ).rejects.toThrow();
  });

  it('should support save with Zod validation', async () => {
    const saved = await repository.save({ name: 'saved' });
    expect(Array.isArray(saved)).toBe(false);
    expect((saved as any).name).toBe('saved');

    await expect(repository.save({ name: 123 } as any)).rejects.toThrow();
  });

  it('should support insert and upsert with Zod validation', async () => {
    const inserted = await repository.insert({ name: 'inserted' });
    expect(inserted.identifiers.length).toBe(1);

    const upserted = await repository.upsert(
      { id: inserted.identifiers[0].id, name: 'upserted' },
      ['id'],
    );
    expect(upserted.identifiers.length).toBe(1);

    await expect(repository.insert({ name: 123 } as any)).rejects.toThrow();
    await expect(
      repository.upsert({ id: 'some-id', name: 123 } as any, ['id']),
    ).rejects.toThrow();
  });

  it('should support find and findAndCount with Zod parsing', async () => {
    await repository.create({ name: 'find1' });
    await repository.create({ name: 'find2' });

    const results = await repository.find();
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some((r) => r.name === 'find1')).toBe(true);

    const [items, count] = await repository.findAndCount();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(items.length).toBe(count);
  }, 30000);

  it('should support delete', async () => {
    const docRef = await repository.create({ name: 'to-delete' });
    await repository.delete(docRef.id);
    const doc = await repository.findOne(docRef.id);
    expect(doc).toBeNull();
  }, 30000);
});
