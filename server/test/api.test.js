import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createPool } from '../db.js'
import { createApp } from '../app.js'

test('PostgreSQL API: account isolation, rate snapshots, budgets and origin guard', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL)
  const app = createApp({ pool, origin: 'http://localhost:5173', fetchImpl: async () => ({ ok: true, json: async () => ({ date: '2024-03-08', base: 'USD', quote: 'CNY', rate: 7.19 }) }) })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const emailA = `a-${randomUUID()}@example.com`
  const emailB = `b-${randomUUID()}@example.com`
  const call = async (route, { method = 'GET', cookie, body, origin = 'http://localhost:5173' } = {}) => {
    const response = await fetch(`${base}/api${route}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], setCookie: response.headers.get('set-cookie') }
  }
  try {
    const first = await call('/auth/register', { method: 'POST', body: { name: 'Alice', email: emailA, password: 'a-long-password-123' } })
    assert.equal(first.status, 201)
    assert.match(first.cookie, /^tango_session=/)
    assert.match(first.setCookie, /HttpOnly/)
    assert.match(first.setCookie, /SameSite=Strict/)
    const second = await call('/auth/register', { method: 'POST', body: { name: 'Bob', email: emailB, password: 'a-long-password-456' } })
    assert.equal(second.status, 201)
    const payload = { type: 'expense', category: '餐饮美食', note: 'Trip lunch', currency: 'USD', amount: '12.50', date: '2024-03-10' }
    const created = await call('/transactions', { method: 'POST', cookie: first.cookie, body: payload })
    assert.equal(created.status, 201)
    assert.equal(created.data.item.amountCny, 89.88)
    assert.equal(created.data.item.rateDate, '2024-03-08')
    assert.equal(created.data.item.rateSource, 'FRANKFURTER')
    const id = created.data.item.id
    assert.equal((await call('/transactions', { cookie: second.cookie })).data.items.length, 0)
    assert.equal((await call(`/transactions/${id}`, { method: 'PUT', cookie: second.cookie, body: payload })).status, 404)
    assert.equal((await call(`/transactions/${id}`, { method: 'DELETE', cookie: second.cookie })).status, 404)
    assert.equal((await call('/budgets/餐饮美食', { method: 'PUT', cookie: first.cookie, body: { amount: '2000' } })).status, 200)
    assert.equal((await call('/budgets', { cookie: first.cookie })).data.budgets['餐饮美食'], 2000)
    assert.equal((await call('/budgets', { cookie: second.cookie })).data.budgets['餐饮美食'], 1800)
    assert.equal((await call('/transactions', { method: 'POST', cookie: first.cookie, body: payload, origin: 'https://evil.example' })).status, 403)
    assert.equal((await call(`/transactions/${id}`, { method: 'DELETE', cookie: first.cookie })).status, 204)
    assert.equal((await call('/transactions', { cookie: first.cookie })).data.items.length, 0)
    assert.equal((await call('/account', { method: 'DELETE', cookie: first.cookie, body: { password: 'wrong-password' } })).status, 401)
    assert.equal((await call('/account', { method: 'DELETE', cookie: first.cookie, body: { password: 'a-long-password-123' } })).status, 204)
    assert.equal((await call('/auth/me', { cookie: first.cookie })).status, 401)
    assert.equal((await call('/auth/logout', { method: 'POST', cookie: second.cookie })).status, 204)
    assert.equal((await call('/auth/me', { cookie: second.cookie })).status, 401)
  } finally {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[emailA, emailB]])
    await new Promise((resolve) => server.close(resolve))
    await pool.end()
  }
})
