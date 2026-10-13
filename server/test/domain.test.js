import test from 'node:test'
import assert from 'node:assert/strict'
import { convertToCnyMinor, parseTransaction, fromMinor, rowToTransaction } from '../domain.js'
import { hashPassword, verifyPassword, tokenHash } from '../security.js'
import { fetchFrankfurterRate, resolveRate } from '../fx.js'
import { transactionsToCsv } from '../../src/finance.js'

const valid = { type: 'expense', category: '餐饮美食', note: '午餐', currency: 'USD', amount: '12.50', date: '2024-03-10' }

test('validates transactions and exact two-decimal amounts', () => {
  assert.equal(parseTransaction(valid).amount.toString(), '12.5')
  assert.throws(() => parseTransaction({ ...valid, amount: '12.345' }), /最多两位小数/)
  assert.throws(() => parseTransaction({ ...valid, amount: '-1' }), /金额须大于/)
  assert.throws(() => parseTransaction({ ...valid, date: '2024-02-30' }), /日期无效/)
  assert.throws(() => parseTransaction({ ...valid, category: '工资收入' }), /分类无效/)
})

test('rounds converted minor units once and keeps the saved snapshot', () => {
  assert.equal(convertToCnyMinor('12.50', '7.123456'), 8904)
  const row = rowToTransaction({ id: 'x', type: 'expense', category: '餐饮美食', note: '午餐', occurred_on: '2024-03-10', currency: 'USD', amount_minor: '1250', amount_cny_minor: '8904', fx_rate: '7.123456', fx_observed_on: '2024-03-08', fx_source: 'FRANKFURTER' })
  assert.equal(row.amount, 12.5)
  assert.equal(row.amountCny, 89.04)
  assert.equal(row.rateDate, '2024-03-08')
  assert.equal(fromMinor('8904'), 89.04)
})

test('password hashing uses a unique salt and rejects bad credentials', async () => {
  const a = await hashPassword('a-long-password-123')
  const b = await hashPassword('a-long-password-123')
  assert.notEqual(a, b)
  assert.equal(await verifyPassword('a-long-password-123', a), true)
  assert.equal(await verifyPassword('wrong', a), false)
  assert.equal(await verifyPassword('anything', 'bad-hash'), false)
  assert.equal(tokenHash('abc').length, 64)
})

test('uses the provider observation date for a historical weekend', async () => {
  const observed = await fetchFrankfurterRate('USD', '2024-03-10', async (url) => {
    assert.match(url, /usd\/cny\?date=2024-03-10/)
    return { ok: true, json: async () => ({ date: '2024-03-08', base: 'USD', quote: 'CNY', rate: 7.19 }) }
  })
  assert.deepEqual(observed, { rate: '7.19', observedDate: '2024-03-08', source: 'FRANKFURTER' })
})

test('uses exact-date cache and allows explicit manual rate when provider fails', async () => {
  const queries = []
  const pool = { query: async (sql, params) => { queries.push([sql, params]); return { rowCount: 0, rows: [] } } }
  const rate = await resolveRate(pool, { currency: 'GBP', date: '2024-03-10', manualRate: parseTransaction({ ...valid, currency: 'GBP', manualRate: '9.2' }).manualRate }, async () => { throw new Error('must not call provider') })
  assert.equal(rate.source, 'MANUAL')
  assert.equal(queries.length, 0)
  await assert.rejects(() => resolveRate(pool, { currency: 'GBP', date: '2024-03-10' }, async () => { throw new Error('network down') }), (error) => error.code === 'FX_UNAVAILABLE' && error.status === 503)
})

test('CSV export preserves rate provenance and neutralizes spreadsheet formulas', () => {
  const csv = transactionsToCsv([{ date: '2024-03-10', type: 'expense', category: '餐饮美食', note: '=HYPERLINK("bad")', amount: 12.5, currency: 'USD', amountCny: 89.88, fxRate: 7.19, rateDate: '2024-03-08', rateSource: 'FRANKFURTER' }])
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/)
  assert.match(csv, /"7.19","2024-03-08","FRANKFURTER"/)
})
