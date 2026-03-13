import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  RulesTestContext,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { join } from 'path';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Use real timers for Firebase
  jest.useRealTimers();

  const rules = readFileSync(
    join(__dirname, '../../../../../../../firestore.rules'),
    'utf8',
  );
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-twenty',
    firestore: {
      rules,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules', () => {
  const workspaceId = 'workspace-123';
  const otherWorkspaceId = 'workspace-456';

  let unauthedDb: any;
  let workspaceAuthedDb: any;
  let otherWorkspaceAuthedDb: any;

  beforeEach(() => {
    unauthedDb = testEnv.unauthenticatedContext().firestore();

    workspaceAuthedDb = testEnv
      .authenticatedContext('user-1', {
        workspaceId,
      })
      .firestore();

    otherWorkspaceAuthedDb = testEnv
      .authenticatedContext('user-2', {
        workspaceId: otherWorkspaceId,
      })
      .firestore();
  });

  describe('Standard Collections (e.g. companies, people)', () => {
    it('should deny unauthenticated users to read or write', async () => {
      // @ts-expect-error
      await expect(
        unauthedDb.collection('companies').doc('c1').get(),
      ).rejects.toThrow();
      // @ts-expect-error
      await expect(
        unauthedDb.collection('companies').doc('c1').set({ workspaceId }),
      ).rejects.toThrow();
    });

    it('should allow users to read/write in their workspace', async () => {
      // First, seed data using system context to bypass rules for setup
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('companies')
          .doc('c1')
          .set({ workspaceId });
      });

      // User from same workspace reads
      const doc = await workspaceAuthedDb
        .collection('companies')
        .doc('c1')
        .get();
      expect(doc.exists).toBe(true);

      // User from same workspace writes
      await expect(
        workspaceAuthedDb
          .collection('companies')
          .doc('c2')
          .set({ workspaceId }),
      ).resolves.toBeUndefined();
    });

    it('should deny users reading/writing in other workspaces', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('companies')
          .doc('c1')
          .set({ workspaceId });
      });

      // User from other workspace reads
      // @ts-expect-error
      await expect(
        otherWorkspaceAuthedDb.collection('companies').doc('c1').get(),
      ).rejects.toThrow();

      // User from other workspace writes
      // @ts-expect-error
      await expect(
        otherWorkspaceAuthedDb
          .collection('companies')
          .doc('c2')
          .set({ workspaceId }),
      ).rejects.toThrow();
    });

    it('should prevent hijacking another workspace document via update', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('companies')
          .doc('c1')
          .set({ workspaceId });
      });

      // A user in otherWorkspace tries to hijack the doc from workspace by updating its workspaceId
      // @ts-expect-error
      await expect(
        otherWorkspaceAuthedDb
          .collection('companies')
          .doc('c1')
          .update({ workspaceId: otherWorkspaceId }),
      ).rejects.toThrow();
    });

    it('should allow deletion of own workspace document but prevent deletion of others', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('companies')
          .doc('c1')
          .set({ workspaceId, createdBy: { id: 'user-1' } });
      });

      // A user in otherWorkspace tries to delete the doc from workspace
      // @ts-expect-error
      await expect(
        otherWorkspaceAuthedDb.collection('companies').doc('c1').delete(),
      ).rejects.toThrow();

      // User from same workspace deletes
      await expect(
        workspaceAuthedDb.collection('companies').doc('c1').delete(),
      ).resolves.toBeUndefined();
    });
  });

  describe('Users Collection', () => {
    it('should allow users to read themselves', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('user-1')
          .set({ workspaceId: 'system' });
      });

      const doc = await workspaceAuthedDb
        .collection('users')
        .doc('user-1')
        .get();
      expect(doc.exists).toBe(true);
    });

    it('should allow a user to read another user\'s profile in the same workspace', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('user-3')
          .set({ workspaceId });
      });

      const doc = await workspaceAuthedDb
        .collection('users')
        .doc('user-3')
        .get();
      expect(doc.exists).toBe(true);
    });

    it('should not allow users to read other users unless they have system workspace access', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('user-2')
          .set({ workspaceId: 'system' });
      });

      // user-1 tries to read user-2
      // @ts-expect-error
      await expect(
        workspaceAuthedDb.collection('users').doc('user-2').get(),
      ).rejects.toThrow();
    });

    it('should NOT allow a user to read a user\'s profile in a different workspace', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc('user-4')
          .set({ workspaceId: otherWorkspaceId });
      });

      // @ts-expect-error
      await expect(
        workspaceAuthedDb.collection('users').doc('user-4').get(),
      ).rejects.toThrow();
    });
  });

  describe('Notes Collection', () => {
    it('should allow a user to delete their own note', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notes').doc('note1').set({
          workspaceId: workspaceId,
          createdBy: { id: 'user-1' }
        });
      });

      await expect(
        workspaceAuthedDb.collection('notes').doc('note1').delete()
      ).resolves.toBeUndefined();
    });

    it('should NOT allow a user to delete someone else\'s note', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notes').doc('note2').set({
          workspaceId: workspaceId,
          createdBy: { id: 'user-2' }
        });
      });

      // @ts-expect-error
      await expect(
        workspaceAuthedDb.collection('notes').doc('note2').delete()
      ).rejects.toThrow();
    });

    it('should allow a workspace admin to delete any note in their workspace', async () => {
      const adminAuthedDb = testEnv
        .authenticatedContext('user-3', {
          workspaceId: workspaceId,
          role: 'ADMIN'
        })
        .firestore();

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notes').doc('note3').set({
          workspaceId: workspaceId,
          createdBy: { id: 'user-1' }
        });
      });

      await expect(
        adminAuthedDb.collection('notes').doc('note3').delete()
      ).resolves.toBeUndefined();
    });

    it('should NOT allow reading notes from a different workspace', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('notes').doc('note4').set({
          workspaceId: otherWorkspaceId,
          createdBy: { id: 'user-2' }
        });
      });

      // @ts-expect-error
      await expect(
        workspaceAuthedDb.collection('notes').doc('note4').get()
      ).rejects.toThrow();
    });
  });
});
