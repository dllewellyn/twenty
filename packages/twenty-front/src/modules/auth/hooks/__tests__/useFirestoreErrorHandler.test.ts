import { renderHook } from '@testing-library/react';
import { useFirestoreErrorHandler } from '../useFirestoreErrorHandler';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { t } from '@lingui/core/macro';

// Mock the useSnackBar hook
jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: jest.fn(),
}));

describe('useFirestoreErrorHandler', () => {
  let enqueueErrorSnackBarMock: jest.Mock;

  beforeEach(() => {
    enqueueErrorSnackBarMock = jest.fn();
    (useSnackBar as jest.Mock).mockReturnValue({
      enqueueErrorSnackBar: enqueueErrorSnackBarMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle permission-denied error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'permission-denied' });

    expect(enqueueErrorSnackBarMock).toHaveBeenCalledWith({
      message: "You don't have permission to perform this action. This might be restricted by ownership or role rules."
    });
  });

  it('should handle not-found error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'not-found' });

    expect(enqueueErrorSnackBarMock).toHaveBeenCalledWith({
      message: "The requested record was not found."
    });
  });

  it('should handle failed-precondition error', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'failed-precondition' });

    expect(enqueueErrorSnackBarMock).toHaveBeenCalledWith({
      message: "A required index is missing. Please contact support."
    });
  });

  it('should handle default error with message', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({ code: 'unknown-error', message: 'Something went wrong' });

    expect(enqueueErrorSnackBarMock).toHaveBeenCalledWith({
      message: "Something went wrong"
    });
  });

  it('should handle default error without message', () => {
    const { result } = renderHook(() => useFirestoreErrorHandler());

    result.current.handleError({});

    expect(enqueueErrorSnackBarMock).toHaveBeenCalledWith({
      message: "An unexpected error occurred."
    });
  });
});
