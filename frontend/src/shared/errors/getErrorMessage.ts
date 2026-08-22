interface ErrorResponseBody {
  message?: unknown;
}

interface ErrorLike {
  message?: unknown;
  response?: {
    data?: ErrorResponseBody;
  };
}

export function getErrorMessage(
  error: unknown,
  fallback = 'An unexpected error occurred',
): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const errorLike = error as ErrorLike;
  const responseMessage = errorLike.response?.data?.message;
  if (typeof responseMessage === 'string' && responseMessage.length > 0) {
    return responseMessage;
  }

  if (typeof errorLike.message === 'string' && errorLike.message.length > 0) {
    return errorLike.message;
  }

  return fallback;
}
