import { Kysely, Migrator, Migration, MigrationProvider } from 'kysely';
import * as createTickets from './migrations/001-create-tickets';

/** In-code migration provider (see auth service for the rationale). */
class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001-create-tickets': createTickets,
    };
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
