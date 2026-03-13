import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN_APP } from './firebase.constants';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);

  constructor(
    @Inject(FIREBASE_ADMIN_APP)
    private readonly firebaseApp: admin.app.App,
  ) {}

  public get auth(): admin.auth.Auth {
    try {
      return this.firebaseApp.auth();
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Auth', error);
      throw new InternalServerErrorException(
        'Failed to initialize Firebase Auth',
      );
    }
  }

  public async verifyIdToken(
    token: string,
  ): Promise<admin.auth.DecodedIdToken> {
    try {
      return await this.auth.verifyIdToken(token);
    } catch (error) {
      this.logger.error('Failed to verify Firebase ID token', error);
      throw error;
    }
  }

  public async setCustomClaims(uid: string, claims: object): Promise<void> {
    try {
      await this.auth.setCustomUserClaims(uid, claims);
    } catch (error) {
      this.logger.error(`Failed to set custom claims for user ${uid}`, error);
      throw error;
    }
  }
}
