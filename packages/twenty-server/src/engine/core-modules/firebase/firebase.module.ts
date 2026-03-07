import { Module } from '@nestjs/common';
import { TwentyConfigModule } from '../twenty-config/twenty-config.module';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseAdminService } from './firebase-admin.service';

@Module({
  imports: [TwentyConfigModule],
  providers: [FirebaseAdminProvider, FirebaseAdminService],
  exports: [FirebaseAdminProvider, FirebaseAdminService],
})
export class FirebaseModule {}