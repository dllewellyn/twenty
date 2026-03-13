import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Command } from 'nest-commander';
import { CommandRunner } from 'nest-commander';
import { Logger } from '@nestjs/common';
import { FIREBASE_ADMIN_APP } from 'src/engine/core-modules/firebase/firebase.constants';

@Command({
  name: 'database:verify-firebase-users',
  description: 'Verifies if users from Firestore exist in Firebase Auth.',
})
export class VerifyFirebaseUsersCommand extends CommandRunner {
  protected readonly logger = new Logger(VerifyFirebaseUsersCommand.name);

  constructor(
    @Inject(FIREBASE_ADMIN_APP)
    protected readonly firebaseApp: admin.app.App,
  ) {
    super();
  }

  public async run(
    _passedParams: string[],
    options?: { limit?: number },
  ): Promise<void> {
    const db = this.firebaseApp
      ? this.firebaseApp.firestore()
      : admin.firestore();
    const auth = this.firebaseApp
      ? this.firebaseApp.auth()
      : admin.auth();

    const collectionName = 'users';

    try {
      this.logger.log(`Fetching users from Firestore ${collectionName} collection...`);
      const snapshot = await db.collection(collectionName).limit(options.limit || 50).get();

      if (snapshot.empty) {
        this.logger.log(`No users found in Firestore.`);
        return;
      }

      this.logger.log(`Found ${snapshot.size} users. Checking against Firebase Auth...`);

      let found = 0;
      let notFound = 0;

      for (const doc of snapshot.docs) {
        const userData = doc.data();
        const primaryEmail = userData.emails?.find((e: any) => e.primary)?.email;

        if (!primaryEmail) {
          this.logger.log(`User ${doc.id} has no primary email.`);
          continue;
        }

        try {
          await auth.getUserByEmail(primaryEmail);
          found++;
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            notFound++;
            this.logger.log(`User ${primaryEmail} not found in Firebase Auth.`);
          } else {
            this.logger.error(`Error checking user ${primaryEmail}:`, error);
          }
        }
      }

      this.logger.log(`\nVerification complete:`);
      this.logger.log(`- Found in Firebase Auth: ${found}`);
      this.logger.log(`- Not found in Firebase Auth: ${notFound}`);
    } catch (error) {
      this.logger.error(`Failed to verify users.`, error);
      throw error;
    }
  }
}
