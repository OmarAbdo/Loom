import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';

/**
 * Teach Zod the `.openapi()` method.
 *
 * MUST RUN BEFORE ANY SCHEMA THAT CALLS `.openapi()` IS CONSTRUCTED. Calling it
 * here — at module scope of the file every service imports to build its spec —
 * guarantees the patch is applied the moment `@omarabdo/ticketing-common` is
 * loaded, before service schema modules evaluate. It is idempotent, so repeated
 * imports across a service are harmless.
 */
extendZodWithOpenApi(z);

/**
 * The `{ errors: [...] }` envelope every service returns on failure.
 *
 * Declared once here and referenced by all four services so the documented
 * error shape cannot drift from `errorHandler`'s actual output. Registered as a
 * named component (`ErrorResponse`) so it appears once in the spec and is
 * `$ref`-ed by each failure response rather than being inlined per-route.
 */
export const ErrorResponseSchema = z
  .object({
    errors: z.array(
      z.object({
        message: z.string().openapi({ example: 'Email must be valid' }),
        field: z
          .string()
          .optional()
          .openapi({
            description:
              'Present for field-level failures; the dot-path of the offending input.',
            example: 'email',
          }),
      })
    ),
  })
  .openapi('ErrorResponse');

/**
 * Standard failure responses, so each route declares its error cases by
 * spreading the ones that apply rather than restating the envelope.
 *
 * @example
 * responses: { 201: {...}, ...errorResponses(400, 401) }
 */
const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation failed, or the request is invalid for the current state.',
  401: 'Not authenticated — no valid session cookie was supplied.',
  403: 'Authenticated, but not the owner of this resource.',
  404: 'The requested resource does not exist.',
};

export function errorResponses(...codes: number[]) {
  const out: Record<number, unknown> = {};
  for (const code of codes) {
    out[code] = {
      description: ERROR_DESCRIPTIONS[code] ?? 'Error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    };
  }
  return out;
}

/**
 * Build a service's OpenAPI 3.1 document from its registered paths.
 *
 * Each service owns ONE registry and registers its own routes into it — the
 * spec is generated per service, mirroring how each service owns its Avro event
 * contracts. There is no central spec that all services must agree on, which is
 * deliberate: a shared spec would be exactly the lockstep-deploy coupling
 * ADR-0004 keeps out of the common package.
 *
 * The session cookie is registered as a security scheme because every
 * authenticated route in this system authenticates the same way — via the
 * `session` cookie set by the auth service, carrying the JWT.
 *
 * @param registry  the service's registry, with all routes already registered
 * @param opts.title        human name shown in Swagger UI
 * @param opts.version      spec version — bump on a breaking route change
 * @param opts.description  short prose describing the service's responsibility
 */
export function buildOpenApiDocument(
  registry: OpenAPIRegistry,
  opts: { title: string; version: string; description: string }
) {
  registry.registerComponent('securitySchemes', 'sessionCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'session',
    description:
      'Base64-encoded JSON session cookie set by the auth service; contains the JWT.',
  });

  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: opts.title,
      version: opts.version,
      description: opts.description,
    },
    servers: [
      {
        url: 'https://ticketing.dev',
        description: 'Local dev cluster (via the nginx ingress)',
      },
    ],
  });
}

export { OpenAPIRegistry, z };
