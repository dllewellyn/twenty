import { renderHook } from '@testing-library/react';
import { useFirestoreErrorHandler } from '../useFirestoreErrorHandler';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

// Mock the useSnackBar hook
jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: jest.fn(),
}));

describe('useFirestoreErrorHandler', () => {
  let enqueueSnackBarMock: jest.Mock;

  beforeEach(() => {
    enqueueSnackBarMock = jest.fn();
    (useSnackBar as jest.Mock).mockReturnValue({
      enqueueSnackBar: enqueueSnackBarMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle permission-denied error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'permission-denied' });

    expect(enqueueSnackBarMock).toHaveBeenCalledWith(
      "You don't have permission to perform this action. This might be restricted by ownership or role rules.",
      { variant: 'error' }
    );
  });

  it('should handle not-found error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'not-found' });

    expect(enqueueSnackBarMock).toHaveBeenCalledWith(
      "The requested record was not found.",
      { variant: 'error' }
    );
  });

  it('should handle failed-precondition error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'failed-precondition' });

    expect(enqueueSnackBarMock).toHaveBeenCalledWith(
      "A required index is missing. Please contact support.",
      { variant: 'error' }
    );
  });

  it('should handle default error with message', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'unknown-error', message: 'Something went wrong' });

    expect(enqueueSnackBarMock).toHaveBeenCalledWith(
      "Something went wrong",
      { variant: 'error' }
    );
  });

  it('should handle default error without message', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({});

    expect(enqueueSnackBarMock).toHaveBeenCalledWith(
      "An unexpected error occurred.",
      { variant: 'error' }
    );
  });
});
