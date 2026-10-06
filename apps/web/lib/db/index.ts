import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../drizzle/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak ada di environment');
}

const globalForDb = globalThis as typeof globalThis & {
  postgresClient?: ReturnType<typeof postgres>;
};

const postgresClient =
  globalForDb.postgresClient ??
  postgres(connectionString, { max: 1, prepare: false });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.postgresClient = postgresClient;
}

export const db = drizzle(postgresClient, { schema });
export { schema };
