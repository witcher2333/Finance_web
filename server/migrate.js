import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readdir } from 'node:fs/promises'
import { createPool } from './db.js'

const pool = createPool()
const directory = fileURLToPath(new URL('./migrations/', import.meta.url))
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(82361742)')
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file)).sort()
  for (const file of files) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file])
    if (applied.rowCount) continue
    await client.query(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'))
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
    console.log(`Applied migration ${file}`)
  }
  await client.query('COMMIT')
  console.log('Database migrations are current')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
