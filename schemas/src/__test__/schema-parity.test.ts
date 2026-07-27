/**
 * Schema parity guard.
 *
 * PURPOSE
 * -------
 * We hand-author the TypeScript event interfaces (schemas/types/*) as a mirror
 * of the Avro schemas (schemas/avro/*.avsc) instead of generating them. That
 * buys clean, idiomatic types at the cost of two artifacts that could drift.
 * This test is the mechanism that prevents drift: it fails the build if a schema
 * and its expected field set disagree.
 *
 * WHAT IT CHECKS
 * --------------
 *  1. Every .avsc in the topic map parses as a valid Avro schema (via `avsc`).
 *  2. Each schema's top-level field names + nullability match an explicit
 *     expectation table below. The table is written to match the hand-authored
 *     TS interface, so reviewing "table vs interface" is trivial and any schema
 *     edit that isn't reflected in the table (and thus the type) fails here.
 *
 * NOTE ON APPROACH
 * ----------------
 * TypeScript types are erased at runtime, so we cannot reflect over the
 * interface directly. The expectation table is the runtime-visible stand-in for
 * the interface; keeping it beside the type in review is the discipline the
 * ADR-0002 "hand-authored + guard" decision accepts.
 */
import * as avro from 'avsc';
import { topicSchemas } from '../topic-schema-map';
import { loadSchema } from '../load-schema';
import { Subjects } from '../../types/subjects';

/** Expected top-level fields per topic: name -> whether the field is nullable. */
const expectedFields: Record<Subjects, Record<string, { nullable: boolean }>> = {
  [Subjects.TicketCreated]: {
    id: { nullable: false },
    version: { nullable: false },
    title: { nullable: false },
    price: { nullable: false },
    userId: { nullable: false },
  },
  [Subjects.TicketUpdated]: {
    id: { nullable: false },
    version: { nullable: false },
    title: { nullable: false },
    price: { nullable: false },
    userId: { nullable: false },
    orderId: { nullable: true },
  },
  [Subjects.OrderCreated]: {
    id: { nullable: false },
    version: { nullable: false },
    status: { nullable: false },
    userId: { nullable: false },
    expiresAt: { nullable: false },
    ticket: { nullable: false },
  },
  [Subjects.OrderCancelled]: {
    id: { nullable: false },
    version: { nullable: false },
    ticket: { nullable: false },
  },
  [Subjects.ExpirationComplete]: {
    orderId: { nullable: false },
  },
  [Subjects.PaymentCreated]: {
    id: { nullable: false },
    orderId: { nullable: false },
    stripeId: { nullable: false },
  },
};

/** True if an Avro field type is a union containing "null". */
function isNullableAvroType(type: unknown): boolean {
  return Array.isArray(type) && (type as unknown[]).includes('null');
}

describe('Avro schema parity', () => {
  it.each(topicSchemas)('$topic: .avsc is valid Avro', ({ avscFile }) => {
    const { parsed } = loadSchema(avscFile);
    // avro.Type.forSchema throws if the schema is invalid.
    expect(() => avro.Type.forSchema(parsed as avro.Schema)).not.toThrow();
  });

  it.each(topicSchemas)(
    '$topic: schema fields match the expected (typed) field set',
    ({ topic, avscFile }) => {
      const { parsed } = loadSchema(avscFile);
      const fields = (parsed as { fields: Array<{ name: string; type: unknown }> })
        .fields;

      const actual: Record<string, { nullable: boolean }> = {};
      for (const f of fields) {
        actual[f.name] = { nullable: isNullableAvroType(f.type) };
      }

      expect(actual).toEqual(expectedFields[topic]);
    }
  );

  it('every topic in the Subjects enum has a schema mapping', () => {
    const mapped = new Set(topicSchemas.map((t) => t.topic));
    for (const subject of Object.values(Subjects)) {
      expect(mapped.has(subject)).toBe(true);
    }
  });
});
