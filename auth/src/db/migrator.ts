import { Kysely, Migrator, Migration, MigrationProvider } from 'kysely';
import * as createUsers from './migrations/001-create-users';

/**
 * In-code migration provider.
 *
 * Instead of Kysely's FileMigrationProvider (which globs .js/.ts files off disk
 * and is fussy under ts-node/jest), we import each migration module explicitly
 * and hand Kysely a static map. Adding a migration = import it and add a line
 * here, keyed by an ordered name. This is simplest and works identically in dev,
 * test, and the built image.
 */
class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001-create-users': createUsers,
    };
  }
}

/**
 * Run all pending migrations against the given database. Called at service
 * startup (Phase 5) and in test setup before each suite.
 */
export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((r) => {
    if (r.status === 'Success') {
      console.log(`Migration "${r.migrationName}" applied`);
    } else if (r.status === 'Error') {
      console.error(`Migration "${r.migrationName}" failed`);
    }
  });

  if (error) {
    throw error;
  }
}
