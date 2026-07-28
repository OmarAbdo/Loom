import { ValidationError } from 'express-validator';
import { CustomError } from './custom-error';

/**
 * 400 — request failed `express-validator` checks. Maps each validation failure
 * to `{ message, field? }`; `field` is populated for field-level errors so the
 * client can attribute the problem to a specific input.
 */
export class RequestValidationError extends CustomError {
  statusCode = 400;

  constructor(public errors: ValidationError[]) {
    super('Invalid request parameters');

    // Required because we are extending a built-in class (see CustomError).
    Object.setPrototypeOf(this, RequestValidationError.prototype);
  }

  serializeErrors() {
    return this.errors.map((err) => {
      if (err.type === 'field') {
        return { message: err.msg, field: err.path };
      }
      return { message: err.msg };
    });
  }
}
