declare module 'passport-custom' {
  import { Strategy as PassportStrategy } from 'passport';
  import { Request } from 'express';

  interface StrategyOptions {
    passReqToCallback?: boolean;
  }

  type VerifyCallback = (
    req: Request,
    done: (error: unknown, user?: unknown, info?: unknown) => void,
  ) => void;
  type VerifyFunction = (req: Request) => Promise<unknown> | unknown;

  export class Strategy extends PassportStrategy {
    constructor(verify: VerifyCallback);
    constructor(options: StrategyOptions, verify: VerifyCallback);
    constructor(verify: VerifyFunction);
  }
}
