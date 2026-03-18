import { Module } from '@nestjs/common';
import { TwentyConfigModule } from '../twenty-config/twenty-config.module';
import { FirebaseAdminProvider, FirestoreProvider } from './firebase-admin.provider';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [TwentyConfigModule],
  providers: [FirebaseAdminProvider, FirestoreProvider, FirebaseAdminService],
  exports: [FirebaseAdminProvider, FirestoreProvider, FirebaseAdminService],
})
export class FirebaseModule {}
