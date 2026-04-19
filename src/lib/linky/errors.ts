export type LinkyErrorCode =
  | "BAD_REQUEST"
  | "INVALID_JSON"
  | "INVALID_URLS"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

type LinkyErrorOptions = {
  code?: LinkyErrorCode;
  statusCode?: number;
  details?: Record<string, unknown>;
};

export class LinkyError extends Error {
  code: LinkyErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, options: LinkyErrorOptions = {}) {
    super(message);
    this.name = "LinkyError";
    this.code = options.code ?? "BAD_REQUEST";
    this.statusCode = options.statusCode ?? 400;
    this.details = options.details;
  }
}

export function isLinkyError(error: unknown): error is LinkyError {
  return error instanceof LinkyError;
}
