import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { Repository } from 'typeorm';

import { MigrationCommandRunner } from 'src/database/commands/command-runners/migration.command-runner';
import { FirebaseAdminService } from 'src/engine/core-modules/firebase/firebase-admin.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

@Command({
  name: 'database:import-firebase-auth-users',
  description: 'Imports legacy users from PostgreSQL into Firebase Authentication.',
})
export class ImportFirebaseAuthUsersCommand extends MigrationCommandRunner {
  constructor(
    @InjectRepository(UserEntity)
    protected readonly userRepository: Repository<UserEntity>,
    protected readonly firebaseAdminService: FirebaseAdminService,
  ) {
    super();
  }

  public async runMigrationCommand(
    _passedParams: string[],
    options: { dryRun?: boolean; verbose?: boolean },
  ): Promise<void> {
    try {
      this.logger.log(`Fetching all users from PostgreSQL...`);
      const users = await this.userRepository.find({
        withDeleted: true,
      });

      if (users.length === 0) {
        this.logger.log(`No users found to import.`);
        return;
      }

      this.logger.log(`Found ${users.length} users.`);

      const records: admin.auth.UserImportRecord[] = users.map((user) => {
        const record: admin.auth.UserImportRecord = {
          uid: user.id,
          email: user.email,
          emailVerified: user.isEmailVerified,
          disabled: user.disabled,
          displayName: `${user.firstName} ${user.lastName}`.trim(),
        };

        if (user.passwordHash) {
          record.passwordHash = Buffer.from(user.passwordHash);
        }

        return record;
      });

      if (options.dryRun) {
        this.logger.log(
          `[DRY RUN] Would import ${records.length} users into Firebase Auth.`,
        );
        return;
      }

      this.logger.log(`Importing ${records.length} users into Firebase Auth...`);

      const BATCH_LIMIT = 1000;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < records.length; i += BATCH_LIMIT) {
        const chunk = records.slice(i, i + BATCH_LIMIT);

        try {
          const result = await this.firebaseAdminService.auth.importUsers(
            chunk,
            { hash: { algorithm: 'BCRYPT' } }
          );

          successCount += result.successCount;
          failureCount += result.failureCount;

          if (result.failureCount > 0) {
            result.errors.forEach((err) => {
              this.logger.error(
                `Failed to import user at index ${err.index} in chunk ${i / BATCH_LIMIT}:`,
                err.error,
              );
            });
          }
        } catch (error) {
           this.logger.error(`Failed to import batch starting at index ${i}`, error);
           throw error;
        }
      }

      this.logger.log(`Import complete.`);
      this.logger.log(`Summary:`);
      this.logger.log(`Total Processed: ${records.length}`);
      this.logger.log(`Success Count: ${successCount}`);
      if (failureCount > 0) {
         this.logger.error(`Failure Count: ${failureCount}`);
      } else {
         this.logger.log(`Failure Count: ${failureCount}`);
      }

    } catch (error) {
      this.logger.error(`Failed to import firebase auth users.`, error);
      throw error;
    }
  }
}
