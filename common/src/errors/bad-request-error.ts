import { CustomError } from './custom-error';

/** 400 — a well-formed request that fails a business rule (e.g. paying a cancelled order). */
export class BadRequestError extends CustomError {
  statusCode = 400;

  constructor(public message: string) {
    super(message);

    Object.setPrototypeOf(this, BadRequestError.prototype);
  }

  serializeErrors() {
    return [{ message: this.message }];
  }
}
