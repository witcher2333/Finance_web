import 'dotenv/config'
import { createPool } from './db.js'
import { createApp } from './app.js'

if (process.env.NODE_ENV === 'production') {
  const origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || ''
  if (!/^https:\/\//.test(origin) && !/^http:\/\/localhost(?::\d+)?$/.test(origin)) {
    throw new Error('Production APP_ORIGIN must be HTTPS (or localhost for local containers)')
  }
}

const pool = createPool()
const app = createApp({ pool })
const port = Number(process.env.PORT || 3001)
const server = app.listen(port, '0.0.0.0', () => console.log(`Tango API listening on port ${port}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0) }))
