import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { initializeDatabase, pool } from './database.js'

const backendDirectory = fileURLToPath(new URL('.', import.meta.url))
const storePath = join(backendDirectory, 'data', 'store.json')

async function migrate() {
  const store = JSON.parse(await readFile(storePath, 'utf8'))
  if (!Array.isArray(store.users) || !Array.isArray(store.employees) || !Array.isArray(store.resetTokens)) {
    throw new Error('The JSON store does not contain valid users, employees, and resetTokens arrays.')
  }

  await initializeDatabase()
  const connection = await pool.getConnection()

  try {
    const [counts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM employees) AS employees,
        (SELECT COUNT(*) FROM password_reset_tokens) AS reset_tokens
    `)
    if (Number(counts[0].users) || Number(counts[0].employees) || Number(counts[0].reset_tokens)) {
      throw new Error('Migration requires empty MySQL tables. Back up the database and migrate into a fresh database.')
    }

    await connection.beginTransaction()
    for (const user of store.users) {
      await connection.execute(
        'INSERT INTO users (id, name, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, user.salt, user.hash],
      )
    }
    for (const employee of store.employees) {
      await connection.execute(
        `INSERT INTO employees
          (id, owner_id, name, email, role, department, status, location, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employee.id,
          employee.ownerId,
          employee.name,
          employee.email,
          employee.role,
          employee.department,
          employee.status,
          employee.location,
          employee.startDate,
        ],
      )
    }
    for (const resetToken of store.resetTokens) {
      const expiresAt = new Date(resetToken.expiresAt).toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [resetToken.userId, resetToken.tokenHash, expiresAt],
      )
    }
    await connection.commit()
    console.log(`Migrated ${store.users.length} users and ${store.employees.length} employees to MySQL.`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('MySQL JSON migration failed:', error.message)
  process.exitCode = 1
})
