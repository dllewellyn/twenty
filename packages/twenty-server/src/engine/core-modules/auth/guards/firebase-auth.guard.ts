import { type ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { getRequest } from 'src/utils/extract-request';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-jwt') {
  getRequest(context: ExecutionContext) {
    return getRequest(context);
  }
}
