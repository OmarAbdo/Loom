import { Express, Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Mount Swagger UI and the raw spec for a service.
 *
 * ROUTING CONSTRAINT (the reason `basePath` looks odd)
 * ----------------------------------------------------
 * The ingress routes by URL PREFIX and does not rewrite paths — `/api/users/*`
 * goes to auth-srv, `/api/tickets/*` to tickets-srv, and so on. So the docs for
 * a service MUST live under that service's own API prefix to be reachable from
 * the browser; a bare `/docs` on each service would all collide on the same
 * ingress rule and resolve to the client app instead. Hence:
 *
 *     auth      ->  /api/users/docs
 *     tickets   ->  /api/tickets/docs
 *     orders    ->  /api/orders/docs
 *     payments  ->  /api/payments/docs
 *
 * WHY THE SPEC IS ALSO SERVED AS JSON: the aggregated gateway page at `/docs`
 * loads each service's `<basePath>/docs.json` to present all four in one
 * Swagger UI dropdown. It is also what you point codegen at to generate a
 * typed client.
 *
 * WHY `swaggerUi.serveFiles` AND NOT `swaggerUi.serve`: `serve` mutates a
 * module-level singleton, so mounting more than one spec in a process makes the
 * last one win. `serveFiles` binds the assets to THIS router with THIS spec.
 * Only one spec is mounted per service today, but the singleton form is a trap
 * worth not laying.
 *
 * @param app       the service's Express app
 * @param spec      the generated OpenAPI document
 * @param basePath  the service's API prefix, e.g. '/api/users'
 */
export function serveDocs(app: Express, spec: object, basePath: string): void {
  const router = Router();

  // Raw spec — consumed by the aggregated /docs gateway and by client codegen.
  // CORS is open because the gateway page is served from the same host in dev
  // but may be opened directly from a file:// URL when debugging.
  router.get('/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(spec);
  });

  router.use(
    '/docs',
    swaggerUi.serveFiles(spec, {}),
    swaggerUi.setup(spec, {
      customSiteTitle: `${(spec as any).info?.title ?? 'API'} — API docs`,
      // Hide the "Try it out" topbar URL input: the spec is fixed per service.
      customCss: '.swagger-ui .topbar { display: none }',
    })
  );

  app.use(basePath, router);
}
