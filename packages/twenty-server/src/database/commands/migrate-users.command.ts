import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { Repository } from 'typeorm';

import { MigrationCommandRunner } from 'src/database/commands/command-runners/migration.command-runner';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { MetadataService } from 'src/engine/metadata-modules/metadata.service';
import { BaseFirestoreRepository } from 'src/engine/twenty-orm/repository/firestore.repository';

@Command({
  name: 'database:migrate-users',
  description: 'Migrates users records from PostgreSQL to Firestore.',
})
export class MigrateUsersCommand extends MigrationCommandRunner {
  constructor(
    @InjectRepository(UserEntity, 'core')
    protected readonly userRepository: Repository<UserEntity>,
    protected readonly metadataService: MetadataService,
    @Inject(FIREBASE_ADMIN_APP)
    protected readonly firebaseApp: admin.app.App,
  ) {
    super();
  }

  public async runMigrationCommand(
    _passedParams: string[],
    options: { dryRun?: boolean; verbose?: boolean },
  ): Promise<void> {
    const db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();

    const collectionName = 'users';
    const workspaceId = 'system';

    try {
      // 1. Metadata Seeding
      // Check if metadata for users exists in the 'system' workspace
      const _metadataCollection = db.collection('_metadata');
      const metadataSnapshot = await _metadataCollection
        .where('workspaceId', '==', workspaceId)
        .where('namePlural', '==', collectionName)
        .get();

      if (metadataSnapshot.empty) {
        if (options.dryRun) {
          this.logger.log(
            `[DRY RUN] Would seed metadata for ${collectionName} in workspace ${workspaceId}.`,
          );
        } else {
          this.logger.log(
            `Seeding metadata for ${collectionName} in workspace ${workspaceId}...`,
          );

          const jsonSchema = {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              email: { type: 'string' },
              defaultAvatarUrl: { type: 'string' },
              isEmailVerified: { type: 'boolean' },
              disabled: { type: 'boolean' },
              passwordHash: { type: 'string' },
              canImpersonate: { type: 'boolean' },
              canAccessFullAdminPanel: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              deletedAt: { type: 'string', format: 'date-time' },
              locale: { type: 'string' },
            },
            required: [
              'firstName',
              'lastName',
              'email',
              'createdAt',
              'updatedAt',
              'locale',
            ],
            additionalProperties: true, // Typically needed to accept unspecified system properties during dev
          };

          await _metadataCollection.add({
            namePlural: collectionName,
            workspaceId,
            jsonSchema,
          });

          this.logger.log(
            `Successfully seeded metadata for ${collectionName}.`,
          );
        }
      }

      // 2. Setup firestore repository
      const firestoreRepository = new BaseFirestoreRepository<UserEntity>(
        collectionName,
        this.metadataService,
        workspaceId,
        this.firebaseApp,
      );

      // 3. Data Fetching
      const users = await this.userRepository.find({ withDeleted: true });

      if (users.length === 0) {
        this.logger.log(`No users found to migrate.`);
        return;
      }

      // 4. Transformation
      const transformedUsers = users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          appTokens,
          keyValuePairs,
          userWorkspaces,
          workspaceMember,
          currentWorkspace,
          currentUserWorkspace,
          formatEmail,
          ...rest
        } = user as any;

        // Map TypeORM entity to a plain object
        return {
          ...rest,
          createdAt: rest.createdAt
            ? new Date(rest.createdAt).toISOString()
            : undefined,
          updatedAt: rest.updatedAt
            ? new Date(rest.updatedAt).toISOString()
            : undefined,
          deletedAt: rest.deletedAt
            ? new Date(rest.deletedAt).toISOString()
            : undefined,
        };
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would migrate ${transformedUsers.length} users to Firestore.`,
        );
        return;
      }

      this.logger.log(`Migrating ${transformedUsers.length} users...`);

      // 5. Save using batch operation with limits
      const FIRESTORE_BATCH_LIMIT = 500;
      for (let i = 0; i < transformedUsers.length; i += FIRESTORE_BATCH_LIMIT) {
        const chunk = transformedUsers.slice(i, i + FIRESTORE_BATCH_LIMIT);
        await firestoreRepository.save(chunk);
      }

      this.logger.log(
        `Successfully migrated ${transformedUsers.length} users to Firestore.`,
      );
    } catch (error) {
      this.logger.error(`Failed to migrate users.`, error);
      throw error;
    }
  }
}
