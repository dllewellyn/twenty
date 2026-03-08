import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { FIREBASE_ADMIN_APP } from './firebase.constants';
import { TwentyConfigService } from '../twenty-config/twenty-config.service';

export const FirebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN_APP,
  inject: [TwentyConfigService],
  useFactory: (configService: TwentyConfigService): admin.app.App => {
    if (admin.apps.length > 0 && admin.app()) {
      return admin.app();
    }

    const projectId = configService.get('FIREBASE_PROJECT_ID');
    const serviceAccountKey = configService.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    const serviceAccountKeyPath = configService.get(
      'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
    );
    const databaseURL = configService.get('FIREBASE_DATABASE_URL');

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
