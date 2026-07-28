import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../errors/custom-error';

/**
 * Terminal Express error handler. Converts any thrown error into a uniform JSON
 * envelope `{ errors: { message, field? }[] }` so every service responds the
 * same way. Known `CustomError`s carry their own status + serialization; unknown
 * errors are masked as a generic 400 (no internal detail leaks to the client).
 *
 * Register LAST, after all routes. Express 5 forwards errors thrown in async
 * handlers to this automatically (no `express-async-errors` shim needed).
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof CustomError) {
    return res.status(err.statusCode).send({ errors: err.serializeErrors() });
  }

  res.status(400).send({
    errors: [{ message: 'Something went wrong' }],
  });
};
