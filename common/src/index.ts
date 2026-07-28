/**
 * Public surface of @omarabdo/ticketing-common — INFRA ONLY (ADR-0004).
 *
 * This package intentionally exports no domain/event types. Event contracts live
 * in @omarabdo/ticketing-schemas and are imported by services directly, so that
 * changing an event never forces a lockstep upgrade of this shared library.
 *
 * What lives here: HTTP error types, Express middleware, and the Kafka
 * messaging mechanics (base Publisher/Consumer + the kafka-wrapper singleton).
 */

// --- Errors ---------------------------------------------------------------
export * from './errors/bad-request-error';
export * from './errors/custom-error';
export * from './errors/database-connection-error';
export * from './errors/not-authorized-error';
export * from './errors/not-found-error';
export * from './errors/request-validation-error';

// --- Middleware -----------------------------------------------------------
export * from './middlewares/current-user';
export * from './middlewares/error-handler';
export * from './middlewares/require-auth';
export * from './middlewares/validate-request';

// --- Kafka messaging mechanics -------------------------------------------
export * from './events/kafka-wrapper';
export * from './events/base-publisher';
export * from './events/base-listener';
