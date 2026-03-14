import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: RulesTestEnvironment;

describe('Firestore Composite Indexes Verification', () => {
  beforeAll(async () => {
    jest.useRealTimers();
    const rulesPath = resolve(__dirname, '../../../../../../../firestore.rules');
    const rules = readFileSync(rulesPath, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-twenty',
      firestore: {
        rules,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('should verify index for workspaceId and updatedAt on standard collections', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const collectionsToTest = ['people', 'companies', 'notes', 'users', 'noteTargets'];
      for (const coll of collectionsToTest) {
        const ref = collection(db, coll);
        await addDoc(ref, { workspaceId: 'ws-1', updatedAt: '2023-01-01', name: 'Item A' });
        await addDoc(ref, { workspaceId: 'ws-1', updatedAt: '2023-01-02', name: 'Item B' });
        await addDoc(ref, { workspaceId: 'ws-2', updatedAt: '2023-01-01', name: 'Item C' });
      }
    });

    const aliceAuth = testEnv.authenticatedContext('alice', {
      workspaceId: 'ws-1',
      role: 'MEMBER',
    });

    const db = aliceAuth.firestore();
    const collectionsToTest = ['people', 'companies', 'notes', 'noteTargets']; // excluded users due to complex rules requiring either system workspace or specific uid

    for (const coll of collectionsToTest) {
      const ref = collection(db, coll);
      const q = query(
        ref,
        where('workspaceId', '==', 'ws-1'),
        orderBy('updatedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      expect(querySnapshot.empty).toBe(false);
      expect(querySnapshot.docs.length).toBe(2);
      expect(querySnapshot.docs[0].data().name).toBe('Item B');
    }

    // Test users specifically since its read rules differ
    const systemAuth = testEnv.authenticatedContext('system', {
      workspaceId: 'system',
      role: 'ADMIN',
    });
    const systemDb = systemAuth.firestore();
    const usersQ = query(
      collection(systemDb, 'users'),
      where('workspaceId', '==', 'ws-1'),
      orderBy('updatedAt', 'desc')
    );
    const usersSnapshot = await getDocs(usersQ);
    expect(usersSnapshot.empty).toBe(false);
    expect(usersSnapshot.docs.length).toBe(2);
    expect(usersSnapshot.docs[0].data().name).toBe('Item B');
  });

  it('should verify index for workspaceId and createdAt on standard collections', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const collectionsToTest = ['people', 'companies', 'notes', 'opportunities', 'tasks', 'users', 'noteTargets'];
      for (const coll of collectionsToTest) {
        const ref = collection(db, coll);
        await addDoc(ref, { workspaceId: 'ws-1', createdAt: '2023-01-01', name: 'Item A' });
        await addDoc(ref, { workspaceId: 'ws-1', createdAt: '2023-01-02', name: 'Item B' });
        await addDoc(ref, { workspaceId: 'ws-2', createdAt: '2023-01-01', name: 'Item C' });
      }
    });

    const aliceAuth = testEnv.authenticatedContext('alice', {
      workspaceId: 'ws-1',
      role: 'MEMBER',
    });

    const db = aliceAuth.firestore();
    const collectionsToTest = ['people', 'companies', 'notes', 'opportunities', 'tasks', 'noteTargets'];

    for (const coll of collectionsToTest) {
      const ref = collection(db, coll);
      const q = query(
        ref,
        where('workspaceId', '==', 'ws-1'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);

      expect(querySnapshot.empty).toBe(false);
      expect(querySnapshot.docs.length).toBe(2);
      expect(querySnapshot.docs[0].data().name).toBe('Item B');
    }
  });

  it('should verify index for workspaceId, stage, and updatedAt on specialized collections (opportunities)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const oppRef = collection(db, 'opportunities');
      await addDoc(oppRef, { workspaceId: 'ws-1', stage: 'NEW', updatedAt: '2023-01-01', name: 'Opp A' });
      await addDoc(oppRef, { workspaceId: 'ws-1', stage: 'NEW', updatedAt: '2023-01-02', name: 'Opp B' });
      await addDoc(oppRef, { workspaceId: 'ws-1', stage: 'WON', updatedAt: '2023-01-01', name: 'Opp C' });
    });

    const aliceAuth = testEnv.authenticatedContext('alice', {
      workspaceId: 'ws-1',
      role: 'MEMBER',
    });

    const db = aliceAuth.firestore();
    const oppRef = collection(db, 'opportunities');
    const q = query(
      oppRef,
      where('workspaceId', '==', 'ws-1'),
      where('stage', '==', 'NEW'),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    expect(querySnapshot.empty).toBe(false);
    expect(querySnapshot.docs.length).toBe(2);
    expect(querySnapshot.docs[0].data().name).toBe('Opp B');
  });

  it('should verify index for workspaceId, createdBy.id, and updatedAt on specialized collections (tasks)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const taskRef = collection(db, 'tasks');
      await addDoc(taskRef, { workspaceId: 'ws-1', createdBy: { id: 'alice' }, updatedAt: '2023-01-01', name: 'Task A' });
      await addDoc(taskRef, { workspaceId: 'ws-1', createdBy: { id: 'alice' }, updatedAt: '2023-01-02', name: 'Task B' });
      await addDoc(taskRef, { workspaceId: 'ws-1', createdBy: { id: 'bob' }, updatedAt: '2023-01-01', name: 'Task C' });
    });

    const aliceAuth = testEnv.authenticatedContext('alice', {
      workspaceId: 'ws-1',
      role: 'MEMBER',
    });

    const db = aliceAuth.firestore();
    const taskRef = collection(db, 'tasks');
    const q = query(
      taskRef,
      where('workspaceId', '==', 'ws-1'),
      where('createdBy.id', '==', 'alice'),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    expect(querySnapshot.empty).toBe(false);
    expect(querySnapshot.docs.length).toBe(2);
    expect(querySnapshot.docs[0].data().name).toBe('Task B');
  });
});
