import { Logger, Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { FIREBASE_ADMIN_APP } from './firebase.constants';
import { TwentyConfigService } from '../twenty-config/twenty-config.service';

export const FirebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN_APP,
  inject: [TwentyConfigService],
  useFactory: (configService: TwentyConfigService): admin.app.App => {
    const logger = new Logger('FirebaseAdminProvider');

    if (admin.apps.length > 0 && admin.app()) {
      return admin.app();
    }

    let projectId = configService.get('FIREBASE_PROJECT_ID');
    const serviceAccountKey = configService.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccountKeyPath = configService.get(
      'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
    );
    let databaseURL = configService.get('FIREBASE_DATABASE_URL');
    const firebaseConfigStr = configService.get('FIREBASE_CONFIG');

    if (firebaseConfigStr) {
      try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);

        if (!projectId && firebaseConfig.projectId) {
          projectId = firebaseConfig.projectId;
        }

        if (!databaseURL && firebaseConfig.databaseURL) {
          databaseURL = firebaseConfig.databaseURL;
        }

        logger.log('Initializing Firebase Admin SDK using FIREBASE_CONFIG');
      } catch (error) {
        logger.error('Failed to parse FIREBASE_CONFIG', error);
      }
    }

    let credential;

    if (serviceAccountKey) {
      credential = admin.credential.cert(JSON.parse(serviceAccountKey));
    } else if (serviceAccountKeyPath) {
      credential = admin.credential.cert(serviceAccountKeyPath);
    } else {
      credential = admin.credential.applicationDefault();
    }

    const config: admin.AppOptions = {
      credential,
    };

    if (projectId) {
      config.projectId = projectId;
    }

    if (databaseURL) {
      config.databaseURL = databaseURL;
    }

    return admin.initializeApp(config);
  },
};
