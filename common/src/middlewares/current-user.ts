import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/** The identity encoded in the JWT and attached to authenticated requests. */
interface UserPayload {
  id: string;
  email: string;
}

// Augment Express's Request so `req.currentUser` is typed everywhere.
//
// We also declare the minimal `session` shape we read. The concrete `session`
// object is provided at runtime by each service's `cookie-session` middleware;
// declaring only `{ jwt?: string }` here avoids making `cookie-session` a
// dependency of this infra library just for a type.
declare global {
  namespace Express {
    interface Request {
      currentUser?: UserPayload;
      session?: { jwt?: string } | null;
    }
  }
}

/**
 * Populate `req.currentUser` from the JWT in the cookie session, if present and
 * valid. Does NOT reject unauthenticated requests — it only *identifies* the
 * caller when possible; use `requireAuth` to enforce authentication.
 *
 * Verification is local and stateless (shared `JWT_KEY`), so no call to the auth
 * service is needed. See ADR-0005 for the coupling tradeoff this implies.
 */
export const currentUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.session?.jwt) {
    return next();
  }

  try {
    const payload = jwt.verify(
      req.session.jwt,
      process.env.JWT_KEY!
    ) as UserPayload;
    req.currentUser = payload;
  } catch (err) {
    // Invalid/expired token → simply leave the request unauthenticated.
  }

  next();
};
