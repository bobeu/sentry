export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function logServerError(error: unknown, apiError: ApiError, status: number): void {
  if (status < 500 && error instanceof ApiError) {
    return;
  }
  if (error instanceof Error) {
    console.error('http.json_error', {
      status,
      code: apiError.code,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }
  console.error('http.json_error', { status, code: apiError.code, error });
}

function toClientMessage(apiError: ApiError, status: number): string {
  if (status >= 500) {
    return 'Internal server error.';
  }
  return apiError.message;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'Internal server error.');
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

export function jsonError(error: unknown, init?: ResponseInit): Response {
  const apiError = toApiError(error);
  const status = init?.status ?? apiError.status;
  logServerError(error, apiError, status);
  return Response.json(
    {
      error: apiError.code,
      message: toClientMessage(apiError, status),
    },
    { status, headers: init?.headers },
  );
}
