import { Module } from '@nestjs/common';
import { TwentyConfigModule } from '../twenty-config/twenty-config.module';
import { FirebaseAdminProvider } from './firebase-admin.provider';

@Module({
  imports: [TwentyConfigModule],
  providers: [FirebaseAdminProvider],
  exports: [FirebaseAdminProvider],
})
export class FirebaseModule {}