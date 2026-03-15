export const isForbiddenError = (error: any): boolean => {
  if (!error) return false;

  if (
    error.graphQLErrors?.some(
      (err: any) => err?.extensions?.code === 'FORBIDDEN',
    )
  ) {
    return true;
  }

  if (error.networkError && 'statusCode' in error.networkError) {
    return (error.networkError as any).statusCode === 403;
  }

  // Handle regular Response errors from REST APIs
  if (
    error.statusCode === 403 ||
    error.status === 403 ||
    error.response?.status === 403
  ) {
    return true;
  }

  return false;
};
