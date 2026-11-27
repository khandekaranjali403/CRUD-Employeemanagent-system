import { createServer } from 'node:http'
import { Buffer } from 'node:buffer'
import { randomBytes, randomUUID, scryptSync, createHash, timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { initializeDatabase, pool } from './database.js'

const port = Number(process.env.API_PORT || 3001)
const isProduction = process.env.NODE_ENV === 'production'
let initializationPromise
const statuses = new Set(['Active', 'On leave', 'Inactive'])
const departments = new Set(['Design', 'Engineering', 'Marketing', 'People', 'Sales'])
const userColumns = 'id, name, email, salt, password_hash AS hash'
const employeeColumns = "id, owner_id AS ownerId, name, email, role, department, status, location, DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate"

const demoEmployees = [
  ['Olivia Chen', 'olivia.chen@studionorth.co', 'Product Designer', 'Design', 'Active', 'San Francisco, CA', '2022-03-14'],
  ['Ethan Williams', 'ethan.williams@studionorth.co', 'Engineering Lead', 'Engineering', 'Active', 'Brooklyn, NY', '2021-08-02'],
  ['Sofia Patel', 'sofia.patel@studionorth.co', 'People Partner', 'People', 'On leave', 'Austin, TX', '2023-01-09'],
  ['Noah Kim', 'noah.kim@studionorth.co', 'Brand Strategist', 'Marketing', 'Active', 'Portland, OR', '2022-11-21'],
  ['Mia Thompson', 'mia.thompson@studionorth.co', 'Account Executive', 'Sales', 'Active', 'Chicago, IL', '2023-06-05'],
  ['Lucas Garcia', 'lucas.garcia@studionorth.co', 'Frontend Developer', 'Engineering', 'Active', 'Denver, CO', '2024-02-12'],
  ['Amara Johnson', 'amara.johnson@studionorth.co', 'Content Designer', 'Design', 'Inactive', 'Remote', '2020-09-28'],
]

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, expectedHash) {
  const actualHash = scryptSync(password, salt, 64)
  const storedHash = Buffer.from(expectedHash, 'hex')
  return actualHash.length === storedHash.length && timingSafeEqual(actualHash, storedHash)
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email }
}

async function findUserByEmail(email) {
  const [rows] = await pool.execute(`SELECT ${userColumns} FROM users WHERE email = ? LIMIT 1`, [email])
  return rows[0] || null
}

function getSessionToken(request) {
  const cookie = request.headers.cookie || ''
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('peopleflow_session='))?.slice('peopleflow_session='.length) || ''
}

async function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
  await pool.execute(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, userId, expiresAt],
  )
  return token
}

async function readSession(request) {
  const token = getSessionToken(request)
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [sessions] = await pool.execute(
    'SELECT user_id AS userId FROM sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1',
    [tokenHash],
  )
  if (!sessions.length) {
    await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash])
    return null
  }
  const [rows] = await pool.execute(`SELECT ${userColumns} FROM users WHERE id = ? LIMIT 1`, [sessions[0].userId])
  if (!rows.length) {
    await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash])
    return null
  }
  return { token, user: rows[0] }
}

async function initializeApp() {
  await initializeDatabase()
  if (isProduction) return

  const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', ['demo@peopleflow.com'])
  if (existingUsers.length) return

  const user = { id: randomUUID(), name: 'Jamie Rivera', email: 'demo@peopleflow.com', ...hashPassword('Demo123!') }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
      'INSERT INTO users (id, name, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.salt, user.hash],
    )
    for (const [name, email, role, department, status, location, startDate] of demoEmployees) {
      await connection.execute(
        `INSERT INTO employees
          (id, owner_id, name, email, role, department, status, location, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), user.id, name, email, role, department, status, location, startDate],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeApp().catch((error) => {
      initializationPromise = null
      throw error
    })
  }
  return initializationPromise
}

function send(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(payload))
}

function setSessionCookie(response, token, maxAge = 60 * 60 * 24 * 7) {
  const secure = isProduction ? '; Secure' : ''
  response.setHeader('Set-Cookie', `peopleflow_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`)
}

function clearSessionCookie(response) {
  setSessionCookie(response, '', 0)
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1024 * 1024) throw Object.assign(new Error('Request body is too large.'), { status: 413 })
  }
  if (!body) return {}
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400 })
  }
  return parsed
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validateEmployee(input) {
  const employee = {
    name: typeof input.name === 'string' ? input.name.trim() : '',
    email: normalizeEmail(input.email),
    role: typeof input.role === 'string' ? input.role.trim() : '',
    department: typeof input.department === 'string' ? input.department.trim() : '',
    status: typeof input.status === 'string' ? input.status.trim() : '',
    location: typeof input.location === 'string' ? input.location.trim() : '',
    startDate: typeof input.startDate === 'string' ? input.startDate.trim() : '',
  }
  if (employee.name.length < 2 || employee.name.length > 80) return { error: 'Name must be between 2 and 80 characters.' }
  if (employee.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) return { error: 'Enter a valid work email address.' }
  if (employee.role.length < 2 || employee.role.length > 80) return { error: 'Job title must be between 2 and 80 characters.' }
  if (!departments.has(employee.department)) return { error: 'Choose a valid department.' }
  if (!statuses.has(employee.status)) return { error: 'Choose a valid employee status.' }
  if (employee.location.length < 2 || employee.location.length > 80) return { error: 'Location must be between 2 and 80 characters.' }
  const dateParts = employee.startDate.split('-').map(Number)
  const [year, month, day] = dateParts
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(employee.startDate)
    && calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
  if (!hasValidDate) return { error: 'Enter a valid start date.' }
  return { employee }
}

async function routeRequest(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const path = url.pathname
  const method = request.method

  if (method === 'GET' && path === '/api/health') {
    return send(response, 200, { status: 'ok' })
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    const input = await readJson(request)
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    if (name.length < 2 || name.length > 80) return send(response, 400, { error: 'Name must be between 2 and 80 characters.' })
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(response, 400, { error: 'Enter a valid email address.' })
    if (password.length < 8 || password.length > 128) return send(response, 400, { error: 'Password must be between 8 and 128 characters.' })
    const user = { id: randomUUID(), name, email, ...hashPassword(password) }
    try {
      await pool.execute(
        'INSERT INTO users (id, name, email, salt, password_hash) VALUES (?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, user.salt, user.hash],
      )
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return send(response, 409, { error: 'An account with this email already exists.' })
      throw error
    }
    const token = await createSession(user.id)
    setSessionCookie(response, token)
    return send(response, 201, { user: publicUser(user) })
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const input = await readJson(request)
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    const user = await findUserByEmail(email)
    if (!user || !verifyPassword(password, user.salt, user.hash)) return send(response, 401, { error: 'Email or password is incorrect.' })
    const token = await createSession(user.id)
    setSessionCookie(response, token)
    return send(response, 200, { user: publicUser(user) })
  }

  if (method === 'POST' && path === '/api/auth/forgot-password') {
    const input = await readJson(request)
    const email = normalizeEmail(input.email)
    const user = await findUserByEmail(email)
    const result = { message: 'If an account exists for that email, password reset instructions are on the way.' }
    if (user) {
      const token = randomBytes(24).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      await pool.execute(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE token_hash = ?, expires_at = ?`,
        [user.id, tokenHash, expiresAt, tokenHash, expiresAt],
      )
      if (!isProduction) result.resetToken = token
    }
    return send(response, 200, result)
  }

  if (method === 'POST' && path === '/api/auth/reset-password') {
    const input = await readJson(request)
    const email = normalizeEmail(input.email)
    const token = typeof input.token === 'string' ? input.token : ''
    const password = typeof input.password === 'string' ? input.password : ''
    if (password.length < 8 || password.length > 128) return send(response, 400, { error: 'Password must be between 8 and 128 characters.' })
    const user = await findUserByEmail(email)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    if (!user) return send(response, 400, { error: 'That reset code is invalid or has expired. Request a new one and try again.' })
    const [resetTokens] = await pool.execute(
      'SELECT user_id FROM password_reset_tokens WHERE user_id = ? AND token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1',
      [user.id, tokenHash],
    )
    if (!resetTokens.length) return send(response, 400, { error: 'That reset code is invalid or has expired. Request a new one and try again.' })
    const credentials = hashPassword(password)
    await pool.execute(
      'UPDATE users SET salt = ?, password_hash = ? WHERE id = ?',
      [credentials.salt, credentials.hash, user.id],
    )
    await pool.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id])
    await pool.execute('DELETE FROM sessions WHERE user_id = ?', [user.id])
    clearSessionCookie(response)
    return send(response, 200, { message: 'Your password has been updated. You can sign in now.' })
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const token = getSessionToken(request)
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash])
    }
    clearSessionCookie(response)
    return send(response, 200, { message: 'Signed out.' })
  }

  if (method === 'GET' && path === '/api/auth/me') {
    const session = await readSession(request)
    return session ? send(response, 200, { user: publicUser(session.user) }) : send(response, 401, { error: 'Please sign in to continue.' })
  }

  const session = await readSession(request)
  if (!session) return send(response, 401, { error: 'Please sign in to continue.' })

  if (method === 'GET' && path === '/api/employees') {
    const [employees] = await pool.execute(
      `SELECT ${employeeColumns} FROM employees
       WHERE owner_id = ? ORDER BY created_at ASC, id ASC`,
      [session.user.id],
    )
    return send(response, 200, { employees })
  }

  if (method === 'POST' && path === '/api/employees') {
    const input = await readJson(request)
    const validation = validateEmployee(input)
    if (validation.error) return send(response, 400, { error: validation.error })
    const employee = { id: randomUUID(), ownerId: session.user.id, ...validation.employee }
    try {
      await pool.execute(
        `INSERT INTO employees
          (id, owner_id, name, email, role, department, status, location, start_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [employee.id, employee.ownerId, employee.name, employee.email, employee.role, employee.department, employee.status, employee.location, employee.startDate],
      )
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return send(response, 409, { error: 'An employee with this email already exists.' })
      throw error
    }
    return send(response, 201, { employee })
  }

  const employeeMatch = path.match(/^\/api\/employees\/([0-9a-f-]+)$/i)
  if (employeeMatch && method === 'PUT') {
    const input = await readJson(request)
    const validation = validateEmployee(input)
    if (validation.error) return send(response, 400, { error: validation.error })
    const employee = { id: employeeMatch[1], ownerId: session.user.id, ...validation.employee }
    try {
      const [result] = await pool.execute(
        `UPDATE employees
         SET name = ?, email = ?, role = ?, department = ?, status = ?, location = ?, start_date = ?
         WHERE id = ? AND owner_id = ?`,
        [employee.name, employee.email, employee.role, employee.department, employee.status, employee.location, employee.startDate, employee.id, employee.ownerId],
      )
      if (!result.affectedRows) {
        const [existing] = await pool.execute(
          'SELECT id FROM employees WHERE id = ? AND owner_id = ? LIMIT 1',
          [employee.id, employee.ownerId],
        )
        if (!existing.length) return send(response, 404, { error: 'Employee not found.' })
      }
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return send(response, 409, { error: 'An employee with this email already exists.' })
      throw error
    }
    return send(response, 200, { employee })
  }

  if (employeeMatch && method === 'DELETE') {
    const [result] = await pool.execute(
      'DELETE FROM employees WHERE id = ? AND owner_id = ?',
      [employeeMatch[1], session.user.id],
    )
    if (!result.affectedRows) return send(response, 404, { error: 'Employee not found.' })
    return send(response, 200, { message: 'Employee removed.' })
  }

  return send(response, 404, { error: 'Not found.' })
}

export async function handleRequest(request, response) {
  try {
    await ensureInitialized()
    await routeRequest(request, response)
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error)
      return
    }
    console.error('API request failed:', error)
    send(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong on the server.' })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await ensureInitialized()
  const server = createServer(handleRequest)
  server.listen(port, '0.0.0.0', () => {
    console.log(`Peopleflow API listening on http://localhost:${port}`)
    console.log('Demo sign in: demo@peopleflow.com / Demo123!')
  })
}
