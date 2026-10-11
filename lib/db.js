import { neon } from '@neondatabase/serverless';

// One lazily-created client per serverless instance. Neon's HTTP driver is
// stateless, so this is safe to reuse across requests.
let client;

export function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Parameterised query helper: query('SELECT * FROM deals WHERE id = $1', [id])
export async function query(text, params = []) {
  return sql().query(text, params);
}

export async function getConfig() {
  const rows = await query(
    'SELECT sectors, stages, watchlist, portfolio, updated_at FROM config WHERE id = 1'
  );
  if (!rows.length) throw new Error('Config row missing: run db/schema.sql in Neon');
  return rows[0];
}
