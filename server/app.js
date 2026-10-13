import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Decimal from 'decimal.js'
import { EXPENSE_CATEGORIES, InputError, fromMinor, parseTransaction, rowToTransaction, toMinor, convertToCnyMinor } from './domain.js'
import { clearSessionCookie, createSession, hashPassword, normalizeEmail, readSessionToken, tokenHash, validatePassword, verifyPassword } from './security.js'
import { resolveRate } from './fx.js'

const DEFAULT_BUDGETS = { '餐饮美食': 1800, '购物消费': 1500, '交通出行': 800, '住房账单': 4500, '娱乐休闲': 1200, '学习成长': 800, '医疗健康': 500, '其他支出': 600 }
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function publicUser(row) { return { id: row.id, email: row.email, name: row.name } }
function budgetObject(rows) { return Object.fromEntries(rows.map((row) => [row.category, fromMinor(row.amount_minor)])) }

export function createApp({ pool, fetchImpl = fetch, origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173' }) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '32kb' }))
  app.use((request, response, next) => {
    const id = randomUUID()
    response.setHeader('X-Request-ID', id)
    const started = Date.now()
    response.on('finish', () => console.log(JSON.stringify({ time: new Date().toISOString(), requestId: id, method: request.method, path: request.path, status: response.statusCode, ms: Date.now() - started })))
    next()
  })
  app.use((request, _response, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== origin) return next(new InputError('请求来源无效', 'BAD_ORIGIN', 403))
    next()
  })

  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false, message: { code: 'RATE_LIMITED', error: '尝试次数过多，请 15 分钟后再试' } })

  async function requireAuth(request, _response, next) {
    try {
      const token = readSessionToken(request)
      if (!token) throw new InputError('请先登录', 'UNAUTHORIZED', 401)
      const result = await pool.query('SELECT users.id, users.email, users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=$1 AND sessions.expires_at > now()', [tokenHash(token)])
      if (!result.rowCount) throw new InputError('登录已过期，请重新登录', 'UNAUTHORIZED', 401)
      request.user = result.rows[0]
      request.sessionHash = tokenHash(token)
      next()
    } catch (error) { next(error) }
  }

  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'tango-api' }))
  app.get('/api/ready', async (_request, response, next) => { try { await pool.query('SELECT 1'); response.json({ ok: true }) } catch (error) { next(new InputError('数据库暂不可用', 'DATABASE_UNAVAILABLE', 503)) } })

  app.post('/api/auth/register', authLimit, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email)
      const password = validatePassword(request.body?.password)
      const name = String(request.body?.name || '').trim()
      if (!name || name.length > 50) throw new InputError('名字需要 1 至 50 个字符')
      const passwordHash = await hashPassword(password)
      const userId = randomUUID()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('INSERT INTO users (id, email, name, password_hash) VALUES ($1,$2,$3,$4)', [userId, email, name, passwordHash])
        for (const [category, amount] of Object.entries(DEFAULT_BUDGETS)) await client.query('INSERT INTO budgets (user_id, category, amount_minor) VALUES ($1,$2,$3)', [userId, category, toMinor(amount)])
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
      await createSession(pool, userId, response)
      response.status(201).json({ user: { id: userId, email, name } })
    } catch (error) { if (error.code === '23505') return next(new InputError('这个邮箱已经注册', 'EMAIL_EXISTS', 409)); next(error) }
  })

  app.post('/api/auth/login', authLimit, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email)
      const password = String(request.body?.password || '')
      const result = await pool.query('SELECT id, email, name, password_hash FROM users WHERE email=$1', [email])
      const user = result.rows[0]
      if (!user || !(await verifyPassword(password, user.password_hash))) throw new InputError('邮箱或密码错误', 'INVALID_CREDENTIALS', 401)
      await createSession(pool, user.id, response)
      response.json({ user: publicUser(user) })
    } catch (error) { next(error) }
  })

  app.get('/api/auth/me', requireAuth, (request, response) => response.json({ user: publicUser(request.user) }))
  app.post('/api/auth/logout', requireAuth, async (request, response, next) => {
    try { await pool.query('DELETE FROM sessions WHERE token_hash=$1', [request.sessionHash]); clearSessionCookie(response); response.status(204).end() } catch (error) { next(error) }
  })

  app.get('/api/transactions', requireAuth, async (request, response, next) => {
    try {
      const offset = Number(request.query.offset || 0)
      if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) throw new InputError('分页参数无效')
      const result = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY occurred_on DESC, id DESC LIMIT 101 OFFSET $2', [request.user.id, offset])
      response.json({ items: result.rows.slice(0, 100).map(rowToTransaction), hasMore: result.rows.length > 100 })
    } catch (error) { next(error) }
  })

  async function saveTransaction(request, response, next, isUpdate) {
    try {
      if (isUpdate && !ID.test(request.params.id || '')) throw new InputError('交易 ID 无效')
      const input = parseTransaction(request.body)
      const fx = await resolveRate(pool, input, fetchImpl)
      const converted = convertToCnyMinor(input.amount, fx.rate)
      if (converted <= 0 || !Number.isSafeInteger(converted)) throw new InputError('折算金额超出范围')
      const id = isUpdate ? request.params.id : randomUUID()
      const client = await pool.connect()
      let row
      try {
        await client.query('BEGIN')
        if (isUpdate) {
          const result = await client.query('UPDATE transactions SET type=$1,category=$2,note=$3,occurred_on=$4,currency=$5,amount_minor=$6,amount_cny_minor=$7,fx_rate=$8,fx_observed_on=$9,fx_source=$10,updated_at=now() WHERE id=$11 AND user_id=$12 RETURNING *', [input.type, input.category, input.note, input.date, input.currency, toMinor(input.amount), converted, fx.rate, fx.observedDate, fx.source, id, request.user.id])
          if (!result.rowCount) throw new InputError('交易不存在', 'NOT_FOUND', 404)
          row = result.rows[0]
        } else {
          const result = await client.query('INSERT INTO transactions (id,user_id,type,category,note,occurred_on,currency,amount_minor,amount_cny_minor,fx_rate,fx_observed_on,fx_source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [id, request.user.id, input.type, input.category, input.note, input.date, input.currency, toMinor(input.amount), converted, fx.rate, fx.observedDate, fx.source])
          row = result.rows[0]
        }
        await client.query('INSERT INTO audit_events (user_id, action, resource_id) VALUES ($1,$2,$3)', [request.user.id, isUpdate ? 'TRANSACTION_UPDATED' : 'TRANSACTION_CREATED', id])
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
      response.status(isUpdate ? 200 : 201).json({ item: rowToTransaction(row) })
    } catch (error) { next(error) }
  }
  app.post('/api/transactions', requireAuth, (request, response, next) => saveTransaction(request, response, next, false))
  app.put('/api/transactions/:id', requireAuth, (request, response, next) => saveTransaction(request, response, next, true))

  app.delete('/api/transactions/:id', requireAuth, async (request, response, next) => {
    try {
      if (!ID.test(request.params.id || '')) throw new InputError('交易 ID 无效')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id', [request.params.id, request.user.id])
        if (!result.rowCount) throw new InputError('交易不存在', 'NOT_FOUND', 404)
        await client.query('INSERT INTO audit_events (user_id, action, resource_id) VALUES ($1,$2,$3)', [request.user.id, 'TRANSACTION_DELETED', request.params.id])
        await client.query('COMMIT')
      } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
      response.status(204).end()
    } catch (error) { next(error) }
  })

  app.get('/api/budgets', requireAuth, async (request, response, next) => {
    try { const result = await pool.query('SELECT category,amount_minor FROM budgets WHERE user_id=$1', [request.user.id]); response.json({ budgets: budgetObject(result.rows) }) } catch (error) { next(error) }
  })
  app.put('/api/budgets/:category', requireAuth, async (request, response, next) => {
    try {
      const category = request.params.category
      if (!EXPENSE_CATEGORIES.includes(category)) throw new InputError('分类无效')
      let amount
      try { amount = new Decimal(String(request.body?.amount)) } catch { throw new InputError('预算金额无效') }
      if (!amount.isFinite() || amount.lt(0) || amount.gt(1_000_000_000) || amount.decimalPlaces() > 2) throw new InputError('预算金额无效')
      await pool.query('INSERT INTO budgets (user_id,category,amount_minor) VALUES ($1,$2,$3) ON CONFLICT (user_id,category) DO UPDATE SET amount_minor=EXCLUDED.amount_minor,updated_at=now()', [request.user.id, category, toMinor(amount)])
      response.json({ category, amount: amount.toNumber() })
    } catch (error) { next(error) }
  })

  app.delete('/api/account', requireAuth, async (request, response, next) => {
    try {
      const password = String(request.body?.password || '')
      const result = await pool.query('SELECT password_hash FROM users WHERE id=$1', [request.user.id])
      if (!(await verifyPassword(password, result.rows[0]?.password_hash))) throw new InputError('密码错误', 'INVALID_CREDENTIALS', 401)
      await pool.query('DELETE FROM users WHERE id=$1', [request.user.id])
      clearSessionCookie(response)
      response.status(204).end()
    } catch (error) { next(error) }
  })

  app.use('/api', (_request, _response, next) => next(new InputError('接口不存在', 'NOT_FOUND', 404)))
  if (process.env.NODE_ENV === 'production') {
    const dist = fileURLToPath(new URL('../dist/', import.meta.url))
    app.use(express.static(dist, { maxAge: '1h' }))
    app.get('/', (_request, response) => response.sendFile(path.join(dist, 'index.html')))
  }
  app.use((error, request, response, _next) => {
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500)
    const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'INVALID_INPUT')
    if (status >= 500) console.error(JSON.stringify({ time: new Date().toISOString(), requestId: response.getHeader('X-Request-ID'), code, message: error.message }))
    response.status(status).json({ code, error: status === 500 ? '服务器暂时不可用' : error.message })
  })
  return app
}
