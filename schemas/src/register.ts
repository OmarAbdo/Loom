/**
 * Register every Avro event schema with the Confluent Schema Registry.
 *
 * WHAT THIS DOES
 * --------------
 * For each entry in the topic->schema map, this script registers the schema
 * under its `<topic>-value` subject. Registration is idempotent: registering an
 * identical schema again returns the existing schema id; registering a *changed*
 * schema is accepted only if it satisfies the subject's compatibility rule
 * (see below), otherwise the registry rejects it.
 *
 * WHY WE REGISTER UP FRONT
 * ------------------------
 * Producers *could* auto-register on first publish, but registering explicitly
 * (a) makes the contract a deliberate, reviewable step rather than a side effect
 * of running a service, and (b) lets us set compatibility before any data flows.
 * This is the Newman-aligned "contract is an explicit artifact" stance.
 *
 * COMPATIBILITY MODE
 * ------------------
 * We want BACKWARD compatibility: a new schema version must be able to read data
 * written by the previous version (consumers upgraded before producers). The
 * *global* default compatibility is set to BACKWARD on the registry itself at
 * deploy time (see infra/k8s, Phase 3). This script additionally attempts to set
 * per-subject compatibility to BACKWARD; if the installed client version does not
 * expose that method, it logs a note and relies on the global default. Either way
 * the effective mode is BACKWARD.
 *
 * USAGE
 * -----
 *   SCHEMA_REGISTRY_URL=http://localhost:8081 npm run register
 */
import { SchemaRegistryClient } from '@confluentinc/schemaregistry';
import { topicSchemas } from './topic-schema-map';
import { loadSchema } from './load-schema';

const SCHEMA_REGISTRY_URL =
  process.env.SCHEMA_REGISTRY_URL ?? 'http://localhost:8081';

async function main() {
  const registry = new SchemaRegistryClient({ baseURLs: [SCHEMA_REGISTRY_URL] });

  console.log(`Registering ${topicSchemas.length} schema(s) at ${SCHEMA_REGISTRY_URL}`);

  for (const { topic, avscFile, subject } of topicSchemas) {
    const { raw } = loadSchema(avscFile);

    // Best-effort per-subject compatibility = BACKWARD. Method name/availability
    // can vary across client versions; the global registry default is the
    // authoritative fallback, so a failure here is non-fatal.
    const anyRegistry = registry as unknown as {
      updateCompatibility?: (subject: string, level: string) => Promise<unknown>;
    };
    if (typeof anyRegistry.updateCompatibility === 'function') {
      try {
        await anyRegistry.updateCompatibility(subject, 'BACKWARD');
      } catch (err) {
        console.warn(
          `  [!] Could not set per-subject compatibility for ${subject}; ` +
            `relying on the registry's global BACKWARD default. (${(err as Error).message})`
        );
      }
    }

    const id = await registry.register(subject, {
      schemaType: 'AVRO',
      schema: raw,
    });

    console.log(`  [ok] ${topic}  ->  subject ${subject}  (schema id ${id})`);
  }

  console.log('All schemas registered.');
}

main().catch((err) => {
  console.error('Schema registration failed:', err);
  process.exit(1);
});
