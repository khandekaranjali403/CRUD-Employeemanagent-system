import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const backendDirectory = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(backendDirectory, '.env') })

const isVercel = Boolean(process.env.VERCEL)

if (isVercel) {
  const missingSettings = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter((key) => !process.env[key])
  if (missingSettings.length) {
    throw new Error(`Missing Vercel database settings: ${missingSettings.join(', ')}`)
  }
}

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'peopleflow',
  waitForConnections: true,
  connectionLimit: isVercel ? 1 : 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
  ssl: (process.env.MYSQL_SSL === 'true' || (isVercel && process.env.MYSQL_SSL !== 'false'))
    ? { rejectUnauthorized: true }
    : undefined,
})

export async function initializeDatabase() {
  const schema = await readFile(join(backendDirectory, 'schema.sql'), 'utf8')
  const statements = schema.split(';').map((statement) => statement.trim()).filter(Boolean)

  for (const statement of statements) {
    await pool.query(statement)
  }
}
