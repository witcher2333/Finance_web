import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { InputError } from './domain.js'

const scrypt = promisify(scryptCallback)
const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('请输入有效邮箱')
  return email
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) throw new InputError('密码需要 12 至 128 个字符')
  return value
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored || '').split(':')
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expectedHex || '')) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return timingSafeEqual(expected, actual)
}

export const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export function cookieOptions() {
  return { httpOnly: true, sameSite: 'strict', secure: String(process.env.APP_ORIGIN || '').startsWith('https://'), path: '/api', maxAge: SESSION_AGE_MS }
}

export async function createSession(pool, userId, response) {
  const token = randomBytes(32).toString('hex')
  await pool.query('DELETE FROM sessions WHERE expires_at < now()')
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash(token), userId, new Date(Date.now() + SESSION_AGE_MS)])
  response.cookie('tango_session', token, cookieOptions())
}

export function readSessionToken(request) {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('tango_session='))
  const token = cookie?.slice('tango_session='.length)
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null
}

export function clearSessionCookie(response) {
  const { maxAge: _maxAge, ...options } = cookieOptions()
  response.clearCookie('tango_session', options)
}
