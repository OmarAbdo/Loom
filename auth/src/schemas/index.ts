/**
 * =============================================================================
 * auth service — HTTP contracts (ADR-0006)
 * =============================================================================
 *
 * The synchronous counterpart to the Avro `.avsc` files in `schemas/avro`.
 * Events crossing Kafka are governed by Avro + Schema Registry; requests and
 * responses crossing HTTP are governed by the Zod schemas below, which also
 * generate this service's OpenAPI document.
 *
 * ONE SOURCE OF TRUTH: each schema is used three ways — runtime validation via
 * `validateRequest`, the static TS type via `z.infer`, and the OpenAPI spec via
 * `.openapi()` metadata. They cannot drift, because there is only one of them.
 *
 * WHY AUTH HAS NO .avsc FILE: auth publishes no events. It issues JWTs and other
 * services verify the signature locally (ADR-0005), so it has no async boundary
 * and therefore no Avro contract. These Zod schemas are its entire public
 * contract surface.
 * =============================================================================
 */
import { z } from '@omarabdo/ticketing-common';

/**
 * A user as returned to clients. Never contains the password hash — that
 * exclusion is enforced twice: `UserRepository` never selects the column, and
 * this schema would strip it if it ever did.
 *
 * This is the schema that closes the "response shape is whatever the repository
 * returns" gap: adding a column to the repository's `.returning()` no longer
 * silently changes the public API.
 */
export const UserResponse = z
  .object({
    id: z.uuid().openapi({
      description: 'DB-generated uuid primary key.',
      example: '3f1a8c2e-9b4d-4f7a-8e21-0c5d6a7b8e90',
    }),
    email: z.email().openapi({ example: 'test@test.com' }),
  })
  .openapi('User');

/**
 * Signup body.
 *
 * The 4–20 character password bound is the course's original rule, preserved
 * deliberately: it is a weak policy, but changing it here would silently
 * invalidate existing test fixtures. Documented rather than quietly "fixed".
 */
export const SignupBody = z
  .object({
    email: z.email({ message: 'Email must be valid' }).openapi({
      description: 'Must be unique across users; the duplicate check is a 400.',
      example: 'test@test.com',
    }),
    password: z
      .string({ message: 'You must supply a password' })
      .min(4, { message: 'Password must be between 4 and 20 characters' })
      .max(20, { message: 'Password must be between 4 and 20 characters' })
      .openapi({ example: 'password' }),
  })
  .openapi('SignupRequest');

/**
 * Signin body.
 *
 * NOTE ON `.trim()`: the pre-Zod implementation ran `body('password').trim()`,
 * which mutated the submitted password before comparison — meaning a password
 * with meaningful leading/trailing spaces could never be entered correctly.
 * A `[TODO]` in the old signin route flagged this. The trim is NOT carried
 * over: passwords are compared exactly as supplied. Email is still trimmed and
 * lowercased, which is safe and matches how the signup duplicate check behaves.
 */
export const SigninBody = z
  .object({
    email: z
      .email({ message: 'Email must be valid' })
      .trim()
      .toLowerCase()
      .openapi({ example: 'test@test.com' }),
    password: z
      .string({ message: 'You must supply a password' })
      .min(1, { message: 'You must supply a password' })
      .openapi({ example: 'password' }),
  })
  .openapi('SigninRequest');

/**
 * `GET /api/users/currentuser` response.
 *
 * `currentUser` is null — not absent, and not a 401 — when the caller has no
 * valid session. The client relies on this to distinguish "logged out" from
 * "request failed", so the nullable shape is load-bearing.
 */
export const CurrentUserResponse = z
  .object({
    currentUser: UserResponse.nullable().openapi({
      description: 'The authenticated user, or null when not signed in.',
    }),
  })
  .openapi('CurrentUserResponse');

/** `POST /api/users/signout` response — an intentionally empty object. */
export const SignoutResponse = z.object({}).openapi('SignoutResponse');

export type SignupBodyType = z.infer<typeof SignupBody>;
export type SigninBodyType = z.infer<typeof SigninBody>;
export type UserResponseType = z.infer<typeof UserResponse>;
