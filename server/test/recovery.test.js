import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createPool } from '../db.js'
import { createApp } from '../app.js'
import { generateRecoveryCodes, recoveryCodeHash } from '../recovery.js'

test('recovery codes are unique 128-bit secrets and normalize their display separators', () => {
  const codes = generateRecoveryCodes()
  assert.equal(codes.length, 8)
  assert.equal(new Set(codes).size, 8)
  for (const code of codes) {
    assert.match(code, /^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/)
    assert.equal(recoveryCodeHash(code), recoveryCodeHash(code.replaceAll('-', '').toLowerCase()))
  }
  assert.throws(() => recoveryCodeHash('123456'), { code: 'INVALID_RECOVERY' })
})

test('PostgreSQL API: recovery codes are shown once, rotated, single-use, and revoke sessions', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL)
  const app = createApp({ pool, origin: 'http://localhost:5173' })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const email = `recover-${randomUUID()}@example.com`
  const oldPassword = 'old-password-1234'
  const newPassword = 'new-password-5678'
  const call = async (route, { method = 'GET', cookie, body } = {}) => {
    const response = await fetch(`${base}/api${route}`, {
      method,
      headers: { Origin: 'http://localhost:5173', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers }
  }
  try {
    const registered = await call('/auth/register', { method: 'POST', body: { name: 'Recovery Test', email, password: oldPassword } })
    assert.equal(registered.status, 201)
    assert.equal(registered.data.recoveryCodes.length, 8)
    assert.equal(registered.headers.get('cache-control'), 'no-store')
    const initialCode = registered.data.recoveryCodes[0]
    const sessionCookie = registered.cookie
    assert.equal((await call('/account/recovery-codes', { cookie: sessionCookie })).data.remaining, 8)
    assert.equal((await call('/account/recovery-codes', { method: 'POST', cookie: sessionCookie, body: { password: 'wrong-password' } })).status, 401)

    const rotated = await call('/account/recovery-codes', { method: 'POST', cookie: sessionCookie, body: { password: oldPassword } })
    assert.equal(rotated.status, 200)
    assert.equal(rotated.data.codes.length, 8)
    assert.equal(rotated.headers.get('cache-control'), 'no-store')
    assert.equal((await call('/auth/recover', { method: 'POST', body: { email, code: initialCode, password: newPassword } })).status, 401)
    assert.equal((await call('/auth/recover', { method: 'POST', body: { email: 'other@example.com', code: rotated.data.codes[0], password: newPassword } })).status, 401)

    const recovered = await call('/auth/recover', { method: 'POST', body: { email, code: rotated.data.codes[0], password: newPassword } })
    assert.equal(recovered.status, 200)
    assert.equal((await call('/auth/me', { cookie: sessionCookie })).status, 401)
    assert.equal((await call('/auth/recover', { method: 'POST', body: { email, code: rotated.data.codes[0], password: newPassword } })).status, 401)
    assert.equal((await call('/auth/login', { method: 'POST', body: { email, password: oldPassword } })).status, 401)
    const relogin = await call('/auth/login', { method: 'POST', body: { email, password: newPassword } })
    assert.equal(relogin.status, 200)
    assert.equal((await call('/account/recovery-codes', { cookie: relogin.cookie })).data.remaining, 7)
  } finally {
    await pool.query('DELETE FROM users WHERE email=$1', [email])
    await new Promise((resolve) => server.close(resolve))
    await pool.end()
  }
})
