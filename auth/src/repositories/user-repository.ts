import { AppDatabase } from '../db/db';
import { Password } from '../services/password';

/** A user as seen by the application (never includes the password hash). */
export interface User {
  id: string;
  email: string;
}

/**
 * Data-access for users. Replaces the Mongoose `User` model.
 *
 * What moved where:
 *   - the Mongoose `pre('save')` password-hash hook  -> `create()` hashes before insert
 *   - the `toJSON` transform that deleted `password`  -> `toUser()` never selects/returns it
 *   - `_id` -> a DB-generated uuid `id`
 *
 * The repo takes its `AppDatabase` by construction so the same class works
 * against the cluster DB (service) and a Testcontainers DB (tests).
 */
export class UserRepository {
  constructor(private readonly db: AppDatabase) {}

  /** Find a user by email, including the password hash (for signin comparison). */
  async findByEmailWithPassword(
    email: string
  ): Promise<{ id: string; email: string; password: string } | undefined> {
    return this.db
      .selectFrom('users')
      .select(['id', 'email', 'password'])
      .where('email', '=', email)
      .executeTakeFirst();
  }

  /** True if a user with this email already exists (signup duplicate check). */
  async existsByEmail(email: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    return !!row;
  }

  /**
   * Create a user. Hashes the plaintext password (scrypt) before insert — the
   * behavior the Mongoose pre-save hook provided. Returns the safe `User` shape.
   */
  async create(email: string, plaintextPassword: string): Promise<User> {
    const password = await Password.toHash(plaintextPassword);

    const row = await this.db
      .insertInto('users')
      .values({ email, password })
      .returning(['id', 'email'])
      .executeTakeFirstOrThrow();

    return { id: row.id, email: row.email };
  }
}
