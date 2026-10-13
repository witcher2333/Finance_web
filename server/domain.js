import Decimal from 'decimal.js'

export const CURRENCY_CODES = ['CNY', 'GBP', 'USD', 'EUR']
export const EXPENSE_CATEGORIES = ['餐饮美食', '购物消费', '交通出行', '住房账单', '娱乐休闲', '学习成长', '医疗健康', '其他支出']
export const INCOME_CATEGORIES = ['工资收入', '副业收入', '其他收入']

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError('日期格式应为 YYYY-MM-DD')
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new InputError('日期无效')
  if (value > new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) throw new InputError('不能记录未来日期的交易')
  return value
}

export class InputError extends Error {
  constructor(message, code = 'INVALID_INPUT', status = 400) { super(message); this.code = code; this.status = status }
}

export function parseTransaction(input) {
  if (!input || typeof input !== 'object') throw new InputError('交易内容无效')
  const type = input.type
  if (!['income', 'expense'].includes(type)) throw new InputError('请选择收入或支出')
  const category = String(input.category || '').trim()
  if (!(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).includes(category)) throw new InputError('分类无效')
  const note = String(input.note || '').trim()
  if (note.length > 80) throw new InputError('备注不能超过 80 字')
  const currency = String(input.currency || '').toUpperCase()
  if (!CURRENCY_CODES.includes(currency)) throw new InputError('币种无效')
  let amount
  try { amount = new Decimal(String(input.amount)) } catch { throw new InputError('金额无效') }
  if (!amount.isFinite() || amount.lte(0) || amount.gt(1_000_000_000) || amount.decimalPlaces() > 2) throw new InputError('金额须大于 0，最多两位小数')
  let manualRate = null
  if (input.manualRate !== undefined && input.manualRate !== null && input.manualRate !== '') {
    try { manualRate = new Decimal(String(input.manualRate)) } catch { throw new InputError('手动汇率无效') }
    if (!manualRate.isFinite() || manualRate.lte(0) || manualRate.gt(1_000_000) || manualRate.decimalPlaces() > 10) throw new InputError('手动汇率无效')
  }
  return { type, category, note, currency, amount, date: parseDate(input.date), manualRate }
}

export function toMinor(amount) { return new Decimal(amount).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber() }
export function fromMinor(minor) { return new Decimal(minor).div(100).toNumber() }
export function convertToCnyMinor(amount, rate) { return toMinor(new Decimal(amount).times(rate)) }

export function rowToTransaction(row) {
  return {
    id: row.id, type: row.type, category: row.category, note: row.note,
    date: typeof row.occurred_on === 'string' ? row.occurred_on.slice(0, 10) : row.occurred_on.toISOString().slice(0, 10),
    currency: row.currency.trim(), amount: fromMinor(row.amount_minor), amountCny: fromMinor(row.amount_cny_minor),
    fxRate: Number(row.fx_rate), rateDate: typeof row.fx_observed_on === 'string' ? row.fx_observed_on.slice(0, 10) : row.fx_observed_on.toISOString().slice(0, 10),
    rateSource: row.fx_source,
  }
}
