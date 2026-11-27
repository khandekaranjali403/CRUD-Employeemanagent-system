import dotenv from 'dotenv'
import { MongoClient } from 'mongodb'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const backendDirectory = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(backendDirectory, '.env') })

const isVercel = Boolean(process.env.VERCEL)
const connectionString = process.env.MONGODB_URI || (isVercel ? '' : 'mongodb://127.0.0.1:27017')

if (!connectionString) {
  throw new Error('MONGODB_URI is required when running on Vercel.')
}

const databaseName = process.env.MONGODB_DB || 'employeesystem'

export const client = new MongoClient(connectionString, {
  maxPoolSize: isVercel ? 5 : 10,
  serverSelectionTimeoutMS: 10000,
})
export const db = client.db(databaseName)

let initializationPromise

export function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await client.connect()
      await Promise.all([
        db.collection('users').createIndex({ email: 1 }, { unique: true }),
        db.collection('employees').createIndex({ ownerId: 1, email: 1 }, { unique: true }),
        db.collection('passwordResetTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection('sessions').createIndex({ userId: 1 }),
      ])
      return db
    })().catch((error) => {
      initializationPromise = null
      throw error
    })
  }
  return initializationPromise
}
