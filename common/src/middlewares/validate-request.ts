import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodType, ZodError, ZodIssue } from 'zod';
import { RequestValidationError } from '../errors/request-validation-error';

/**
 * The parts of a request a route may declare a schema for.
 *
 * Each is optional: a route validates only what it actually reads. `body` is
 * the common case; `params` matters for id-bearing routes; `query` for filters.
 */
export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Validate the incoming request against Zod schemas, writing the parsed result
 * back onto the request.
 *
 * WHY IT REASSIGNS: Zod does more than check — it COERCES and STRIPS. Numeric
 * strings become numbers, unknown keys are dropped (mass-assignment defence),
 * and `.trim()` / `.default()` are applied. Writing the parsed value back is
 * what makes the handler see cleaned data rather than raw input, so a handler
 * can trust `req.body` matches the schema's inferred type.
 *
 * WHY `Object.assign` FOR query/params: under Express 5 `req.query` and
 * `req.params` are getter-only accessors on the request prototype — a direct
 * assignment throws at runtime. Mutating the existing object in place is the
 * supported way to write coerced values back. `req.body` is a plain own
 * property, so direct assignment is fine there.
 *
 * ALL-PARTS-AT-ONCE: every declared part is parsed before any error is thrown,
 * so a request with both a bad param and a bad body reports both failures in
 * one response instead of making the client fix them one at a time.
 *
 * Failures become a `RequestValidationError` (400) carrying the same
 * `{ errors: [{ message, field }] }` envelope the services have always emitted.
 *
 * @example
 * router.post('/api/tickets',
 *   requireAuth,
 *   validateRequest({ body: CreateTicketBody }),
 *   handler);
 */
export const validateRequest = (schemas: RequestSchemas): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: ZodIssue[] = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        issues.push(...result.error.issues);
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        Object.assign(req.params, result.data);
      } else {
        issues.push(...result.error.issues);
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        Object.assign(req.query, result.data);
      } else {
        issues.push(...result.error.issues);
      }
    }

    if (issues.length > 0) {
      // Rebuild one ZodError so the error stays Zod-native and all failures
      // across body/params/query surface together in a single response.
      throw new RequestValidationError(new ZodError(issues));
    }

    next();
  };
};
