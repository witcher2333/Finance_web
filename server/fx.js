import Decimal from 'decimal.js'
import { InputError } from './domain.js'

const API_ROOT = 'https://api.frankfurter.dev/v2/rate'

export async function fetchFrankfurterRate(currency, requestedDate, fetchImpl = fetch) {
  const url = `${API_ROOT}/${currency.toLowerCase()}/cny?date=${requestedDate}`
  let response
  try { response = await fetchImpl(url, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' } }) }
  catch { throw new InputError('汇率服务暂时不可用。请稍后重试，或填写手动汇率。', 'FX_UNAVAILABLE', 503) }
  if (!response.ok) throw new InputError('该日期的汇率暂不可用。请换个日期，或填写手动汇率。', 'FX_UNAVAILABLE', 503)
  let data
  try { data = await response.json() } catch { throw new InputError('汇率服务返回了无效数据', 'FX_UNAVAILABLE', 503) }
  let rate
  try { rate = new Decimal(String(data?.rate)) } catch { throw new InputError('汇率服务返回了无效汇率', 'FX_UNAVAILABLE', 503) }
  if (!rate.isFinite() || rate.lte(0) || rate.gt(1_000_000) || String(data?.base).toUpperCase() !== currency || String(data?.quote).toUpperCase() !== 'CNY' || !/^\d{4}-\d{2}-\d{2}$/.test(data?.date || '') || data.date > requestedDate) {
    throw new InputError('汇率服务返回了无效汇率', 'FX_UNAVAILABLE', 503)
  }
  return { rate: rate.toString(), observedDate: data.date, source: 'FRANKFURTER' }
}

export async function resolveRate(pool, { currency, date, manualRate }, fetchImpl = fetch) {
  if (currency === 'CNY') return { rate: '1', observedDate: date, source: 'IDENTITY' }
  if (manualRate) return { rate: manualRate.toString(), observedDate: date, source: 'MANUAL' }
  const cached = await pool.query('SELECT rate, observed_date FROM fx_rates WHERE base_currency=$1 AND quote_currency=$2 AND requested_date=$3', [currency, 'CNY', date])
  if (cached.rowCount) {
    const row = cached.rows[0]
    return { rate: String(row.rate), observedDate: typeof row.observed_date === 'string' ? row.observed_date.slice(0, 10) : row.observed_date.toISOString().slice(0, 10), source: 'CACHED' }
  }
  const result = await fetchFrankfurterRate(currency, date, fetchImpl)
  await pool.query('INSERT INTO fx_rates (base_currency, quote_currency, requested_date, observed_date, rate, source) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (base_currency, quote_currency, requested_date) DO NOTHING', [currency, 'CNY', date, result.observedDate, result.rate, result.source])
  return result
}
