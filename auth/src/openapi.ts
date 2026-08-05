/**
 * =============================================================================
 * auth service — OpenAPI document
 * =============================================================================
 *
 * Registers every route this service exposes, then generates the spec served at
 * `/api/users/docs` (Swagger UI) and `/api/users/docs.json` (raw).
 *
 * WHY REGISTRATION IS SEPARATE FROM THE ROUTE FILES: route modules stay focused
 * on behaviour, and the whole documented surface of the service is legible in
 * one file. The cost is that adding a route means editing here too — an
 * acceptable trade for a service with four endpoints, and a deliberate contrast
 * with the schemas themselves, which live beside nothing and are imported by
 * both the routes and this file.
 * =============================================================================
 */
import {
  OpenAPIRegistry,
  buildOpenApiDocument,
  errorResponses,
} from '@omarabdo/ticketing-common';
import {
  SignupBody,
  SigninBody,
  UserResponse,
  CurrentUserResponse,
  SignoutResponse,
} from './schemas';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'post',
  path: '/api/users/signup',
  tags: ['auth'],
  summary: 'Create an account',
  description:
    'Creates a user, hashes the password with scrypt, and sets the `session` cookie ' +
    'containing a signed JWT. Responds 400 if the email is already in use.',
  request: {
    body: { content: { 'application/json': { schema: SignupBody } } },
  },
  responses: {
    201: {
      description: 'Account created; the session cookie is set.',
      content: { 'application/json': { schema: UserResponse } },
    },
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/users/signin',
  tags: ['auth'],
  summary: 'Sign in to an existing account',
  description:
    'Verifies the password against the stored scrypt hash and sets the `session` ' +
    'cookie. Returns a generic "Invalid credentials" 400 for both an unknown email ' +
    'and a wrong password, so the response cannot be used to enumerate accounts.',
  request: {
    body: { content: { 'application/json': { schema: SigninBody } } },
  },
  responses: {
    200: {
      description: 'Signed in; the session cookie is set.',
      content: { 'application/json': { schema: UserResponse } },
    },
    ...errorResponses(400),
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/users/currentuser',
  tags: ['auth'],
  summary: 'Identify the caller',
  description:
    'Returns the user encoded in the session JWT, or `{ currentUser: null }` when ' +
    'there is no valid session. Never 401s — this endpoint reports authentication ' +
    'state rather than enforcing it.',
  security: [{ sessionCookie: [] }],
  responses: {
    200: {
      description: 'The current user, or null.',
      content: { 'application/json': { schema: CurrentUserResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/users/signout',
  tags: ['auth'],
  summary: 'Sign out',
  description:
    'Clears the session cookie. Always succeeds, including when the caller was ' +
    'not signed in.',
  responses: {
    200: {
      description: 'Session cleared.',
      content: { 'application/json': { schema: SignoutResponse } },
    },
  },
});

export const openApiDocument = buildOpenApiDocument(registry, {
  title: 'Ticketing — auth service',
  version: '1.0.0',
  description:
    'Accounts, sessions, and JWT issuance. The only service with no Kafka events: ' +
    'other services verify its JWTs locally with the shared key (ADR-0005), so auth ' +
    'has no asynchronous contract — these HTTP schemas are its entire public surface.',
});
