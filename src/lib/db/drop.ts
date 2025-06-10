import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool)

async function main() {
  console.log('Dropping all tables...')
  try {
    // The order of dropping tables matters if you don't use CASCADE.
    // With CASCADE, Postgres will handle dependencies.
    // It's still good practice to be explicit.
    await db.execute('DROP TABLE IF EXISTS messages CASCADE;')
    await db.execute('DROP TABLE IF EXISTS conversations CASCADE;')
    await db.execute('DROP TABLE IF EXISTS verification CASCADE;')
    await db.execute('DROP TABLE IF EXISTS account CASCADE;')
    await db.execute('DROP TABLE IF EXISTS session CASCADE;')
    await db.execute('DROP TABLE IF EXISTS "user" CASCADE;') // "user" is a reserved keyword
    await db.execute('DROP TABLE IF EXISTS __drizzle_migrations CASCADE;')

    console.log('All tables dropped successfully!')
    process.exit(0)
  } catch (err) {
    console.error('Error dropping tables:', err)
    process.exit(1)
  }
}

main() 