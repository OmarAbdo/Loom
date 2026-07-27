import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Read an Avro schema file from schemas/avro/ and return both its raw JSON
 * string (what the registry stores) and its parsed object (for validation).
 *
 * Centralized so the register script and the guard test load schemas the same
 * way and from the same directory.
 */
export interface LoadedSchema {
  /** Parsed Avro schema object. */
  parsed: Record<string, unknown>;
  /** Exact file contents as a string — this is what gets registered. */
  raw: string;
}

const AVRO_DIR = join(__dirname, '..', 'avro');

export function loadSchema(avscFile: string): LoadedSchema {
  const raw = readFileSync(join(AVRO_DIR, avscFile), 'utf8');
  return { raw, parsed: JSON.parse(raw) };
}
