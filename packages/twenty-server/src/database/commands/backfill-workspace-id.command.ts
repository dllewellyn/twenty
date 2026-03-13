import { Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Command, CommandRunner, Option } from 'nest-commander';

import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';

@Command({
  name: 'database:backfill-workspace-id',
  description: 'Backfills workspaceId in Firestore for migrated records.',
})
export class BackfillWorkspaceIdCommand extends CommandRunner {
  private readonly logger = new Logger(BackfillWorkspaceIdCommand.name);

  constructor(
    @Inject(FIREBASE_ADMIN_APP)
    protected readonly firebaseApp: admin.app.App,
  ) {
    super();
  }

  async run(
    passedParams: string[],
    options?: Record<string, any>,
  ): Promise<void> {
    const db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();

    const collections = await db.listCollections();
    const BATCH_LIMIT = 500;

    for (const collectionRef of collections) {
      const collectionName = collectionRef.id;
      this.logger.log(`Processing collection: ${collectionName}`);

      let snapshot = await collectionRef.limit(BATCH_LIMIT).get();
      let totalUpdated = 0;

      while (!snapshot.empty) {
        const batch = db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
          const data = doc.data();

          if (collectionName === '_metadata') {
            let needsUpdate = false;
            let updates: any = {};

            if (!data.workspaceId) {
              const workspaceIdToSet = options?.workspaceId || 'system';
              updates.workspaceId = workspaceIdToSet;
              needsUpdate = true;
            }

            // Also check jsonSchema to ensure workspaceId is a property
            if (data.jsonSchema && data.jsonSchema.properties && !data.jsonSchema.properties.workspaceId) {
              updates.jsonSchema = {
                ...data.jsonSchema,
                properties: {
                  ...data.jsonSchema.properties,
                  workspaceId: { type: 'string' },
                },
              };
              needsUpdate = true;
            }

            if (needsUpdate) {
              batch.update(doc.ref, updates);
              batchCount++;
            }
          } else {
            if (!data.workspaceId) {
              let workspaceIdToSet = 'system';

              if (collectionName !== 'users' && collectionName !== '_metadata') {
                if (options?.workspaceId) {
                  workspaceIdToSet = options.workspaceId;
                } else {
                  this.logger.warn(`Missing workspaceId for document ${doc.id} in ${collectionName}. Skipping.`);
                  continue;
                }
              }

              batch.update(doc.ref, { workspaceId: workspaceIdToSet });
              batchCount++;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
          totalUpdated += batchCount;
        }

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        if (lastDoc) {
          snapshot = await collectionRef.startAfter(lastDoc).limit(BATCH_LIMIT).get();
        } else {
          break;
        }
      }

      this.logger.log(`Updated ${totalUpdated} documents in ${collectionName}`);
    }

    this.logger.log('Backfill complete.');
  }

  @Option({
    flags: '-w, --workspaceId [string]',
    description: 'Workspace ID to use for backfilling standard entities',
  })
  parseWorkspaceId(val: string): string {
    return val;
  }
}
