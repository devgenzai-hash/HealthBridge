/**
 * Script to run schema.sql against Supabase database via pg connection.
 * Usage: node scripts/run-schema.mjs
 */

import pg from 'pg'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read schema file
const schemaPath = join(__dirname, '..', 'supabase', 'schema.sql')
const sql = readFileSync(schemaPath, 'utf-8')

async function runSchema() {
  console.log('Connecting to Supabase PostgreSQL...')
  
  const client = new pg.Client({
    host: '2406:da1a:82a:9d02:654b:9b7a:b09:ac3c',
    port: 5432,
    user: 'postgres',
    password: 'AbhiSal!@#$%^&*()',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
  
  try {
    await client.connect()
    console.log('Connected! Running schema...\n')
    
    // Run the entire SQL file
    await client.query(sql)
    
    console.log('✓ Schema executed successfully!')
    console.log('  All tables, indexes, RLS policies, and functions created.')
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('⚠ Some objects already exist (re-run safe). Details:')
      console.log(' ', err.message.slice(0, 300))
    } else {
      console.error('✗ Error:', err.message)
    }
  } finally {
    await client.end()
    console.log('\nDone.')
  }
}

runSchema()
