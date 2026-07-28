/**
 * Base class for all HTTP-mappable application errors.
 *
 * Every error the services throw for a *client-visible* failure extends this.
 * The contract it enforces:
 *   - `statusCode` — the HTTP status to return.
 *   - `serializeErrors()` — a uniform `{ message, field? }[]` shape so every
 *     service returns errors in the same JSON envelope (see errorHandler).
 *
 * Extending the built-in `Error` requires the `Object.setPrototypeOf` call in
 * subclasses so `instanceof` works across the transpilation target boundary.
 */
export abstract class CustomError extends Error {
  abstract statusCode: number;

  constructor(message: string) {
    super(message);

    Object.setPrototypeOf(this, CustomError.prototype);
  }

  abstract serializeErrors(): { message: string; field?: string }[];
}
