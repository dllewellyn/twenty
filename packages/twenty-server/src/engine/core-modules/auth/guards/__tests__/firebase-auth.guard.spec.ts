import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { FirebaseAuthGuard } from 'src/engine/core-modules/auth/guards/firebase-auth.guard';
import { getRequest } from 'src/utils/extract-request';

jest.mock('src/utils/extract-request');

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    guard = new FirebaseAuthGuard();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getRequest', () => {
    it('should call getRequest utility with context', () => {
      const mockContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      guard.getRequest(mockContext);

      expect(getRequest).toHaveBeenCalledWith(mockContext);
    });

    it('should work for HTTP context', () => {
      const mockRequest = { headers: { authorization: 'Bearer token' } };
      const mockContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      (getRequest as jest.Mock).mockReturnValue(mockRequest);

      const result = guard.getRequest(mockContext);

      expect(result).toBe(mockRequest);
      expect(getRequest).toHaveBeenCalledWith(mockContext);
    });

    it('should work for GraphQL context', () => {
      const mockRequest = { headers: { authorization: 'Bearer token' } };
      const mockContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      const mockGqlContext = {
        getContext: jest.fn().mockReturnValue({ req: mockRequest }),
      };

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext as any);
      (getRequest as jest.Mock).mockReturnValue(mockRequest);

      const result = guard.getRequest(mockContext);

      expect(result).toBe(mockRequest);
      expect(getRequest).toHaveBeenCalledWith(mockContext);
    });
  });
});
