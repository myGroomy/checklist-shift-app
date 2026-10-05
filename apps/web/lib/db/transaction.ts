import { db } from './index';

/**
 * Wrapper untuk transaction PostgreSQL.
 * Semua operasi di dalam `fn` berjalan atomik.
 */
export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => fn(tx as unknown as typeof db));
}
