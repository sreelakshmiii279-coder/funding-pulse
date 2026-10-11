// Applies db/schema.sql to DATABASE_URL. Usage: node --env-file=.env.local scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
const { rows } = await pool.query('SELECT sectors, stages, jsonb_array_length(watchlist) AS w FROM config');
console.log('Schema applied. Config:', rows[0]);
await pool.end();
