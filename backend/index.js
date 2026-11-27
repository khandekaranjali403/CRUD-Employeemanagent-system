import { createServer } from 'node:http'
import { Buffer } from 'node:buffer'
import { randomBytes, scryptSync, createHash, timingSafeEqual } from 'node:crypto'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ObjectId } from 'mongodb'
import { db, initializeDatabase } from './database.js'

const port = Number(process.env.API_PORT || 3001)
const isProduction = process.env.NODE_ENV === 'production'
let initializationPromise
const statuses = new Set(['Active', 'On leave', 'Inactive'])
const departments = new Set(['Design', 'Engineering', 'Marketing', 'People', 'Sales'])

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
  return { id: user._id.toString(), name: user.name, email: user.email }
}

function publicEmployee(employee) {
  return {
    id: employee._id.toString(),
    ownerId: employee.ownerId.toString(),
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department,
    status: employee.status,
    location: employee.location,
    startDate: employee.startDate,
  }
}

async function findUserByEmail(email) {
  return db.collection('users').findOne({ email })
}

function getSessionToken(request) {
  const cookie = request.headers.cookie || ''
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('peopleflow_session='))?.slice('peopleflow_session='.length) || ''
}

async function createSession(userId) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.collection('sessions').insertOne({ _id: tokenHash, userId, expiresAt })
  return token
}

async function readSession(request) {
  const token = getSessionToken(request)
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const sessions = db.collection('sessions')
  const session = await sessions.findOne({ _id: tokenHash, expiresAt: { $gt: new Date() } })
  if (!session) {
    await sessions.deleteOne({ _id: tokenHash })
    return null
  }
  const user = await db.collection('users').findOne({ _id: session.userId })
  if (!user) {
    await sessions.deleteOne({ _id: tokenHash })
    return null
  }
  return { token, user }
}

async function initializeApp() {
  await initializeDatabase()
  if (isProduction) return

  const users = db.collection('users')
  if (await users.findOne({ email: 'demo@peopleflow.com' })) return

  const user = { name: 'Jamie Rivera', email: 'demo@peopleflow.com', ...hashPassword('Demo123!'), createdAt: new Date() }
  const { insertedId: ownerId } = await users.insertOne(user)
  const employees = demoEmployees.map(([name, email, role, department, status, location, startDate]) => ({
    ownerId,
    name,
    email,
    role,
    department,
    status,
    location,
    startDate,
    createdAt: new Date(),
  }))
  await db.collection('employees').insertMany(employees)
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
    const user = { name, email, ...hashPassword(password), createdAt: new Date() }
    try {
      const { insertedId } = await db.collection('users').insertOne(user)
      user._id = insertedId
    } catch (error) {
      if (error.code === 11000) return send(response, 409, { error: 'An account with this email already exists.' })
      throw error
    }
    const token = await createSession(user._id)
    setSessionCookie(response, token)
    return send(response, 201, { user: publicUser(user) })
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const input = await readJson(request)
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    const user = await findUserByEmail(email)
    if (!user || !verifyPassword(password, user.salt, user.hash)) return send(response, 401, { error: 'Email or password is incorrect.' })
    const token = await createSession(user._id)
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
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      await db.collection('passwordResetTokens').updateOne(
        { _id: user._id },
        { $set: { tokenHash, expiresAt } },
        { upsert: true },
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
    const resetToken = await db.collection('passwordResetTokens').findOne({
      _id: user._id,
      tokenHash,
      expiresAt: { $gt: new Date() },
    })
    if (!resetToken) return send(response, 400, { error: 'That reset code is invalid or has expired. Request a new one and try again.' })
    const credentials = hashPassword(password)
    await db.collection('users').updateOne({ _id: user._id }, { $set: credentials })
    await db.collection('passwordResetTokens').deleteOne({ _id: user._id })
    await db.collection('sessions').deleteMany({ userId: user._id })
    clearSessionCookie(response)
    return send(response, 200, { message: 'Your password has been updated. You can sign in now.' })
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const token = getSessionToken(request)
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      await db.collection('sessions').deleteOne({ _id: tokenHash })
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
    const employees = await db.collection('employees')
      .find({ ownerId: session.user._id })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()
    return send(response, 200, { employees: employees.map(publicEmployee) })
  }

  if (method === 'POST' && path === '/api/employees') {
    const input = await readJson(request)
    const validation = validateEmployee(input)
    if (validation.error) return send(response, 400, { error: validation.error })
    const employee = { ownerId: session.user._id, ...validation.employee, createdAt: new Date() }
    try {
      const { insertedId } = await db.collection('employees').insertOne(employee)
      employee._id = insertedId
    } catch (error) {
      if (error.code === 11000) return send(response, 409, { error: 'An employee with this email already exists.' })
      throw error
    }
    return send(response, 201, { employee: publicEmployee(employee) })
  }

  const employeeMatch = path.match(/^\/api\/employees\/([0-9a-f]{24})$/i)
  if (employeeMatch && method === 'PUT') {
    const input = await readJson(request)
    const validation = validateEmployee(input)
    if (validation.error) return send(response, 400, { error: validation.error })
    const employee = { _id: new ObjectId(employeeMatch[1]), ownerId: session.user._id, ...validation.employee }
    try {
      const result = await db.collection('employees').updateOne(
        { _id: employee._id, ownerId: employee.ownerId },
        { $set: validation.employee },
      )
      if (!result.matchedCount) return send(response, 404, { error: 'Employee not found.' })
    } catch (error) {
      if (error.code === 11000) return send(response, 409, { error: 'An employee with this email already exists.' })
      throw error
    }
    return send(response, 200, { employee: publicEmployee(employee) })
  }

  if (employeeMatch && method === 'DELETE') {
    const result = await db.collection('employees').deleteOne({
      _id: new ObjectId(employeeMatch[1]),
      ownerId: session.user._id,
    })
    if (!result.deletedCount) return send(response, 404, { error: 'Employee not found.' })
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
