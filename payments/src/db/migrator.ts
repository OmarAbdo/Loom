import { Kysely, Migrator, Migration, MigrationProvider } from 'kysely';
import * as createPayments from './migrations/001-create-payments';

/** In-code migration provider (see auth service for rationale). */
class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return { '001-create-payments': createPayments };
  }
}

export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const migrator = new Migrator({ db, provider: new StaticMigrationProvider() });
  const { error, results } = await migrator.migrateToLatest();
  results?.forEach((r) => {
    if (r.status === 'Success') console.log(`Migration "${r.migrationName}" applied`);
    else if (r.status === 'Error') console.error(`Migration "${r.migrationName}" failed`);
  });
  if (error) throw error;
}
