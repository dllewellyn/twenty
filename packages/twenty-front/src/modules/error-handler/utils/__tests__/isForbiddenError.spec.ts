import { ApolloError } from '@apollo/client';
import { isForbiddenError } from '../isForbiddenError';

describe('isForbiddenError', () => {
  it('should return true for a GraphQL FORBIDDEN error', () => {
    const error = new ApolloError({
      graphQLErrors: [
        {
          message: 'Forbidden',
          extensions: { code: 'FORBIDDEN' },
          nodes: [],
          source: undefined,
          positions: [],
          path: [],
          originalError: undefined,
        } as any,
      ],
    });
    expect(isForbiddenError(error)).toBe(true);
  });

  it('should return true for a network 403 error', () => {
    // Note: When ApolloError is constructed with a networkError that is an object
    // without standard Error features, it might get mangled.
    // We'll test our object directly rather than wrapping in ApolloError
    // to match real-world usages where the object is passed directly.
    const error = {
      networkError: {
        statusCode: 403,
        name: 'ServerError',
        message: 'Forbidden',
      },
    };
    expect(isForbiddenError(error)).toBe(true);
  });

  it('should return true for regular 403 status objects', () => {
    expect(isForbiddenError({ statusCode: 403 })).toBe(true);
    expect(isForbiddenError({ status: 403 })).toBe(true);
    expect(isForbiddenError({ response: { status: 403 } })).toBe(true);
  });

  it('should return false for other GraphQL errors', () => {
    const error = new ApolloError({
      graphQLErrors: [
        {
          message: 'Not Found',
          extensions: { code: 'NOT_FOUND' },
          nodes: [],
          source: undefined,
          positions: [],
          path: [],
          originalError: undefined,
        } as any,
      ],
    });
    expect(isForbiddenError(error)).toBe(false);
  });

  it('should return false for other network errors', () => {
    const error = new ApolloError({
      networkError: {
        statusCode: 404,
        name: 'ServerError',
        message: 'Not Found',
      } as any,
    });
    expect(isForbiddenError(error)).toBe(false);
  });

  it('should return false if no error is provided', () => {
    expect(isForbiddenError(null)).toBe(false);
    expect(isForbiddenError(undefined)).toBe(false);
  });
});
