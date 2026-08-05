import { ZodError, ZodIssue } from 'zod';
import { CustomError } from './custom-error';

/**
 * 400 — the request failed its Zod schema.
 *
 * WIRE-COMPATIBILITY NOTE
 * -----------------------
 * This class previously wrapped `express-validator`'s `ValidationError[]`. It
 * now wraps a Zod `ZodError`, but the SERIALIZED SHAPE IS UNCHANGED:
 *
 *     { errors: [{ message: string, field?: string }] }
 *
 * That envelope is a published contract — the Next.js client renders it, and
 * every service's `errorHandler` emits it. Keeping it byte-identical is what
 * allowed the validator swap without touching clients or route tests.
 *
 * FIELD PATHS: Zod reports `path` as an array (e.g. `['ticket', 'price']`)
 * because schemas nest. We join with '.' so a nested failure reads
 * `ticket.price`. A top-level failure (e.g. the body is not an object at all)
 * has an empty path and omits `field` entirely — matching how express-validator
 * represented its non-field errors.
 */
export class RequestValidationError extends CustomError {
  statusCode = 400;

  constructor(public error: ZodError) {
    super('Invalid request parameters');

    // Required because we are extending a built-in class (see CustomError).
    Object.setPrototypeOf(this, RequestValidationError.prototype);
  }

  serializeErrors() {
    return this.error.issues.map((issue: ZodIssue) => {
      const field = issue.path.join('.');
      return field
        ? { message: issue.message, field }
        : { message: issue.message };
    });
  }
}
