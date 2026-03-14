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

  it('should verify index for workspaceId and updatedAt on standard collections (people)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const peopleRef = collection(db, 'people');
      await addDoc(peopleRef, { workspaceId: 'ws-1', updatedAt: '2023-01-01', name: 'Person A' });
      await addDoc(peopleRef, { workspaceId: 'ws-1', updatedAt: '2023-01-02', name: 'Person B' });
      await addDoc(peopleRef, { workspaceId: 'ws-2', updatedAt: '2023-01-01', name: 'Person C' });
    });

    const aliceAuth = testEnv.authenticatedContext('alice', {
      workspaceId: 'ws-1',
      role: 'MEMBER',
    });

    const db = aliceAuth.firestore();
    const peopleRef = collection(db, 'people');
    const q = query(
      peopleRef,
      where('workspaceId', '==', 'ws-1'),
      orderBy('updatedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    expect(querySnapshot.empty).toBe(false);
    expect(querySnapshot.docs.length).toBe(2);
    expect(querySnapshot.docs[0].data().name).toBe('Person B');
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
